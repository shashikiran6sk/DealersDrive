import {
  dealerSlug,
  formatPhone,
  normaliseLocality,
  toE164,
  type AuthProvidersResponse,
  type AuthSession,
  type OnboardingInput,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import type { MapsPort } from '../../platform/maps/maps-link.js';
import {
  ConfigurationError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from '../../platform/errors.js';
import { logger } from '../../platform/telemetry/logger.js';
import type { DealersService } from '../dealers/dealers.facade.js';
import { isAllowlistedAdmin } from './admin-allowlist.js';
import type { OAuthClaims, OAuthProvider } from './oauth.port.js';
import {
  createOAuthTransaction,
  sealTransaction,
  safeReturnTo,
  DEFAULT_RETURN_TO,
  OAUTH_TRANSACTION_TTL_SECONDS,
  type OAuthAudience,
  type OAuthTransaction,
} from './oauth-transaction.js';
import { ensureSeat, isSeatSuspended } from './roles.js';
import { assertPhoneVerified } from './verified-phone.js';
import { permissionsForRole, type DealerPrincipal, type PendingPrincipal } from './session.port.js';
import type { SessionService } from './session.service.js';

export interface AuthDeps {
  prisma: PrismaClient;
  sessions: SessionService;
  oauth: OAuthProvider;
  dealers: DealersService;
  audit: AuditService;
  maps: MapsPort;
}

export interface CallbackResult {
  token: string;
  expiresAt: Date;
  audience: OAuthAudience;
  next: AuthSession['next'];
  returnTo: string;
}

export function createAuthService({ prisma, sessions, oauth, dealers, audit, maps }: AuthDeps) {
  async function identityFor(userId: string): Promise<AuthSession['identity']> {
    const identity = await prisma.oAuthIdentity.findFirst({
      where: { userId, provider: 'GOOGLE' },
      orderBy: { createdAt: 'asc' },
    });

    if (!identity) return null;

    return {
      provider: 'GOOGLE',
      email: identity.email,
      name: identity.displayName,
      pictureUrl: identity.pictureUrl,
    };
  }

  async function me(principal: DealerPrincipal | PendingPrincipal): Promise<AuthSession> {
    if (principal.kind === 'DEALER') {
      const session = await dealers.session(principal);
      return { ...session, identity: await identityFor(principal.userId) };
    }

    return {
      next: 'ONBOARDING',
      identity: await identityFor(principal.userId),
      user: {
        id: principal.userId,
        fullName: principal.fullName,
        phone: principal.phone ?? '',
        phoneDisplay: principal.phone ? formatPhone(principal.phone) : '',
        phoneVerified: principal.phoneVerified,
        email: principal.email,
        emailVerified: true,
      },
      dealer: null,
      role: null,
      permissions: [],
      counts: { newEnquiries: 0, pendingListings: 0 },
    };
  }

  return {
    me,

    providers(): AuthProvidersResponse {
      const enabled = oauth.isConfigured();
      return {
        google: {
          enabled,
          startUrl: `${env.API_BASE_URL}/v1/auth/google/start`,
          adminStartUrl: `${env.API_BASE_URL}/v1/auth/admin/google/start`,
          reason: enabled
            ? null
            : 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set on the API.',
        },
      };
    },

    startGoogle(
      returnTo: string | undefined,
      audience: OAuthAudience = 'DEALER',
    ): {
      authorizationUrl: string;
      cookie: string;
      maxAgeSeconds: number;
    } {
      if (!oauth.isConfigured()) {
        throw new ConfigurationError(
          'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in ' +
            `.env, and register ${env.GOOGLE_CALLBACK_URL} as an authorized redirect URI on the ` +
            'OAuth 2.0 client in the Google Cloud console.',
          { code: 'OAUTH_NOT_CONFIGURED' },
        );
      }

      const transaction = createOAuthTransaction(
        safeReturnTo(returnTo, DEFAULT_RETURN_TO[audience]),
        audience,
      );

      logger.info({ event: 'auth.oauth.started', provider: 'GOOGLE', audience }, 'oauth started');

      return {
        authorizationUrl: oauth.authorizationUrl({
          state: transaction.state,
          nonce: transaction.nonce,
          codeVerifier: transaction.codeVerifier,
        }),
        cookie: sealTransaction(transaction),
        maxAgeSeconds: OAUTH_TRANSACTION_TTL_SECONDS,
      };
    },

    async completeGoogle(input: {
      code: string;
      state: string;
      transaction: OAuthTransaction | null;
      ip?: string | undefined;
      userAgent?: string | undefined;
    }): Promise<CallbackResult> {
      const { transaction } = input;

      if (!transaction || transaction.state !== input.state) {
        logger.warn({ event: 'auth.oauth.failed', reason: 'state' }, 'oauth state mismatch');
        throw new UnauthorizedError(
          'That sign-in could not be verified. Start again from the sign-in page.',
          { code: 'OAUTH_STATE_INVALID' },
        );
      }

      const claims = await oauth.exchange({
        code: input.code,
        codeVerifier: transaction.codeVerifier,
        nonce: transaction.nonce,
      });

      logger.info({ event: 'auth.oauth.verified', provider: 'GOOGLE' }, 'oauth identity verified');

      if (transaction.audience === 'ADMIN') {
        return await completeAdminGoogle(claims, transaction, input);
      }

      const existing = await prisma.oAuthIdentity.findUnique({
        where: {
          provider_providerSubject: { provider: 'GOOGLE', providerSubject: claims.subject },
        },
        include: { user: { include: { roles: true } } },
      });

      let userId: string;

      if (existing) {
        if (existing.user.status !== 'ACTIVE') {
          throw new ForbiddenError('This account has been suspended. Contact support.', {
            code: 'ACCOUNT_SUSPENDED',
          });
        }

        if (isSeatSuspended(existing.user.roles, 'DEALER')) {
          throw new ForbiddenError('This dealership has been suspended. Contact support.', {
            code: 'ACCOUNT_SUSPENDED',
          });
        }

        userId = existing.userId;
        await prisma.oAuthIdentity.update({
          where: { id: existing.id },
          data: {
            email: claims.email,
            emailVerified: claims.emailVerified,
            displayName: claims.name ?? existing.displayName,
            pictureUrl: claims.picture ?? existing.pictureUrl,
            lastLoginAt: new Date(),
          },
        });
        await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
      } else {
        userId = await createIdentity(claims);
      }

      const membership = await prisma.dealerMember.findFirst({
        where: { userId, status: 'ACTIVE' },
        include: { dealer: true },
        orderBy: { id: 'asc' },
      });

      if (membership?.dealer.status === 'SUSPENDED') {
        throw new ForbiddenError('This dealership has been suspended. Contact support.', {
          code: 'ACCOUNT_SUSPENDED',
        });
      }

      await ensureSeat(prisma, { userId, role: 'DEALER' });

      const session = await sessions.issue({
        userId,
        scope: 'DEALER',
        ip: input.ip,
        userAgent: input.userAgent,
      });

      logger.info(
        { event: 'auth.session.created', scope: 'DEALER', userId },
        'dealer session created',
      );

      const next: AuthSession['next'] = !membership
        ? 'ONBOARDING'
        : membership.dealer.status === 'DRAFT'
          ? 'ONBOARDING'
          : membership.dealer.status === 'PENDING_APPROVAL'
            ? 'PENDING_APPROVAL'
            : 'DASHBOARD';

      return {
        token: session.token,
        expiresAt: session.expiresAt,
        audience: 'DEALER',
        next,
        returnTo: next === 'ONBOARDING' ? '/dealer/onboarding' : transaction.returnTo,
      };
    },

    async onboard(principal: PendingPrincipal, input: OnboardingInput): Promise<AuthSession> {
      const city = normaliseLocality(input.city);
      const district = normaliseLocality(input.district);
      const state = normaliseLocality(input.state);

      const nameOwner = await prisma.dealer.findFirst({
        where: {
          legalName: { equals: input.legalName, mode: 'insensitive' },
          city: { equals: city, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (nameOwner) {
        throw new ConflictError(
          'DEALER_NAME_TAKEN',
          `A dealership called ${input.legalName} is already registered in ${city}.`,
          {
            errors: [
              {
                field: 'body.legalName',
                code: 'DEALER_NAME_TAKEN',
                message: `Already registered in ${city}.`,
              },
            ],
          },
        );
      }

      const phone = toE164(input.phone);
      await assertPhoneVerified(prisma, principal.userId, phone, 'body.phone');

      const place = await maps.placeFor(input.mapsUrl);

      const created = await withTransaction(prisma, async (tx) => {
        const existing = await tx.dealerMember.findFirst({
          where: { userId: principal.userId, status: 'ACTIVE' },
        });
        if (existing) {
          throw new ConflictError(
            'DEALER_ALREADY_EXISTS',
            'This account already manages a dealership.',
          );
        }

        await tx.user.update({
          where: { id: principal.userId },
          data: { fullName: input.fullName },
        });

        const dealer = await tx.dealer.create({
          data: {
            slug: await uniqueSlug({ legalName: input.legalName, city, district, state }),
            brandName: input.legalName,
            legalName: input.legalName,
            status: 'DRAFT',
            city,
            district,
            state,
            addressLine: input.addressLine,
            pincode: input.pincode,
            mapsUrl: input.mapsUrl,
            lat: place.coordinates?.lat ?? null,
            lng: place.coordinates?.lng ?? null,
            mapsPlaceId: place.placeId,
            contactPhone: phone,
            contactEmail: principal.email,
            landline: input.landline ?? null,
            tagline: input.tagline,
            specialities: input.specialities,
          },
        });

        await tx.dealerMember.create({
          data: { dealerId: dealer.id, userId: principal.userId, role: 'OWNER', permissions: [] },
        });

        await tx.dealerDocument.createMany({
          data: (['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF'] as const).map((type) => ({
            dealerId: dealer.id,
            type,
            status: 'REQUIRED' as const,
          })),
        });

        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: principal.userId,
          dealerId: dealer.id,
          action: 'dealer.onboarding.created',
          entityType: 'Dealer',
          entityId: dealer.id,
          after: { slug: dealer.slug, brandName: dealer.brandName, status: dealer.status },
        });

        return { id: dealer.id, slug: dealer.slug };
      });

      logger.info(
        { event: 'dealer.onboarding.created', dealerId: created.id, userId: principal.userId },
        'dealership created',
      );

      return me({
        kind: 'DEALER',
        userId: principal.userId,
        dealerId: created.id,
        dealerSlug: created.slug,
        role: 'OWNER',
        dealerStatus: 'DRAFT',
        permissions: permissionsForRole('OWNER'),
      });
    },

    async logout(token: string | undefined, userId?: string): Promise<void> {
      await sessions.revoke(token);
      logger.info({ event: 'auth.session.revoked', userId: userId ?? null }, 'session revoked');
    },
  };

  async function createIdentity(claims: {
    subject: string;
    email: string;
    emailVerified: boolean;
    name?: string | undefined;
    picture?: string | undefined;
  }): Promise<string> {
    const collision = await prisma.user.findUnique({
      where: { email: claims.email },
      include: { identities: true },
    });

    if (collision) {
      logger.warn(
        { event: 'auth.oauth.failed', reason: 'unlinked-account' },
        'google sign-in matched an existing email with no linked identity',
      );
      throw new ConflictError(
        'ACCOUNT_LINK_REQUIRED',
        'An account already uses this email address. Contact support to link Google sign-in to it.',
      );
    }

    return withTransaction(prisma, async (tx) => {
      const user = await tx.user.create({
        data: {
          email: claims.email,
          emailVerifiedAt: new Date(),
          fullName: claims.name ?? null,
          lastLoginAt: new Date(),
        },
      });

      await tx.oAuthIdentity.create({
        data: {
          userId: user.id,
          provider: 'GOOGLE',
          providerSubject: claims.subject,
          email: claims.email,
          emailVerified: claims.emailVerified,
          displayName: claims.name ?? null,
          pictureUrl: claims.picture ?? null,
          lastLoginAt: new Date(),
        },
      });

      return user.id;
    });
  }

  async function completeAdminGoogle(
    claims: OAuthClaims,
    transaction: OAuthTransaction,
    input: { ip?: string | undefined; userAgent?: string | undefined },
  ): Promise<CallbackResult> {
    const email = claims.email.trim().toLowerCase();

    const granted = await prisma.user.findFirst({
      where: {
        email,
        isPlatformAdmin: true,
        roles: { some: { role: 'ADMIN', status: 'ACTIVE', grantedBy: { not: null } } },
      },
      select: { id: true },
    });

    if (!isAllowlistedAdmin(email) && !granted) {
      logger.warn(
        { event: 'admin.login.failure', reason: 'not-allowlisted' },
        'admin sign-in refused',
      );
      await audit.recordDetached({
        actorType: 'SYSTEM',
        action: 'admin.login.failure',
        entityType: 'User',
        entityId: 'unknown',
        after: { email, reason: 'NOT_ALLOWLISTED' },
      });
      throw new ForbiddenError(
        'That Google account is not authorised for the Dealers-Drive admin console.',
        { code: 'ADMIN_NOT_ALLOWLISTED' },
      );
    }

    const identity = await prisma.oAuthIdentity.findUnique({
      where: { provider_providerSubject: { provider: 'GOOGLE', providerSubject: claims.subject } },
      include: { user: { include: { roles: true } } },
    });

    if (identity && identity.user.status !== 'ACTIVE') {
      throw new ForbiddenError('This account has been suspended. Contact support.', {
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    if (identity && isSeatSuspended(identity.user.roles, 'ADMIN')) {
      throw new ForbiddenError('Your admin access has been withdrawn.', {
        code: 'ADMIN_ACCESS_REVOKED',
      });
    }

    const now = new Date();

    const admin = await withTransaction(prisma, async (tx) => {
      const user =
        identity?.user ??
        (await tx.user.findUnique({ where: { email } })) ??
        (await tx.user.create({
          data: { email, emailVerifiedAt: now, fullName: claims.name ?? null },
        }));

      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          isPlatformAdmin: true,
          adminRole: user.adminRole ?? 'SUPER_ADMIN',
          emailVerifiedAt: user.emailVerifiedAt ?? now,
          fullName: user.fullName ?? claims.name ?? null,
          lastLoginAt: now,
        },
      });

      if (identity) {
        await tx.oAuthIdentity.update({
          where: { id: identity.id },
          data: {
            email: claims.email,
            emailVerified: claims.emailVerified,
            displayName: claims.name ?? identity.displayName,
            pictureUrl: claims.picture ?? identity.pictureUrl,
            lastLoginAt: now,
          },
        });
      } else {
        await tx.oAuthIdentity.create({
          data: {
            userId: updated.id,
            provider: 'GOOGLE',
            providerSubject: claims.subject,
            email: claims.email,
            emailVerified: claims.emailVerified,
            displayName: claims.name ?? null,
            pictureUrl: claims.picture ?? null,
            lastLoginAt: now,
          },
        });
      }

      await ensureSeat(tx, { userId: updated.id, role: 'ADMIN' });

      return updated;
    });

    const session = await sessions.issue({
      userId: admin.id,
      scope: 'ADMIN',
      ip: input.ip,
      userAgent: input.userAgent,
    });

    logger.info({ event: 'admin.login.success', userId: admin.id }, 'admin signed in');
    await audit.recordDetached({
      actorType: 'ADMIN',
      actorId: admin.id,
      action: 'admin.login.success',
      entityType: 'User',
      entityId: admin.id,
    });

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      audience: 'ADMIN',
      next: 'DASHBOARD',
      returnTo: transaction.returnTo,
    };
  }

  async function uniqueSlug(parts: {
    legalName: string;
    city?: string | null;
    district?: string | null;
    state?: string | null;
  }): Promise<string> {
    const base = dealerSlug(parts);

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const taken = await prisma.dealer.findUnique({ where: { slug: candidate } });
      if (!taken) return candidate;
    }

    throw new ConflictError('SLUG_UNAVAILABLE', 'Could not derive a unique address for that name.');
  }
}

export type AuthService = ReturnType<typeof createAuthService>;
