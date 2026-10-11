import { resolveOnboardingLocation } from '../service-locations/service-locations.facade.js';
import {
  adminHomeFor,
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
  DomainError,
  ForbiddenError,
  UnauthorizedError,
} from '../../platform/errors.js';
import { logger } from '../../platform/telemetry/logger.js';
import {
  uniqueDealerSlug,
  normaliseDealerEmail,
  withDealerEmailConflict,
  type DealersService,
} from '../dealers/dealers.facade.js';
import { isAllowlistedAdmin } from './admin-allowlist.js';
import { isAdmitted, syncLegacyAdminColumns } from './admin-member.js';
import {
  ACCOUNT_SUSPENDED,
  DEALERSHIP_SUSPENDED,
  IDENTITY_INCOMPLETE,
  LINK_SESSION_MISMATCH,
} from './auth.messages.js';
import { createIdentityService } from './identity.service.js';
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
import { resolveDealerPostAuthDestination } from './post-auth.js';
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
  token: string | null;
  expiresAt: Date | null;
  audience: OAuthAudience;
  next: AuthSession['next'];
  returnTo: string;
}

export function createAuthService({ prisma, sessions, oauth, dealers, audit, maps }: AuthDeps) {
  const identities = createIdentityService({ prisma, audit });

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
          linkStartUrl: `${env.API_BASE_URL}/v1/auth/google/link/start`,
          reason: enabled
            ? null
            : 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set on the API.',
        },
      };
    },

    startGoogle(
      returnTo: string | undefined,
      audience: OAuthAudience = 'DEALER',
      linkUserId?: string,
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
        linkUserId,
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
      sessionToken?: string | undefined;
      ip?: string | undefined;
      userAgent?: string | undefined;
    }): Promise<CallbackResult> {
      const { transaction } = input;

      if (transaction?.audience === 'LINK' && transaction.state === input.state) {
        await assertLinkSession(transaction, input.sessionToken);
      }

      if (!transaction || transaction.state !== input.state) {
        logger.warn({ event: 'auth.oauth.failed', reason: 'state' }, 'oauth state mismatch');
        throw new UnauthorizedError(
          'That sign-in could not be verified. Start again from the sign-in page.',
          { code: 'OAUTH_STATE_INVALID' },
        );
      }

      const verified = await oauth.exchange({
        code: input.code,
        codeVerifier: transaction.codeVerifier,
        nonce: transaction.nonce,
      });
      const claims = { ...verified, email: normaliseDealerEmail(verified.email) };

      logger.info({ event: 'auth.oauth.verified', provider: 'GOOGLE' }, 'oauth identity verified');

      if (transaction.audience === 'ADMIN') {
        return await completeAdminGoogle(claims, transaction, input);
      }

      if (transaction.audience === 'LINK') {
        return await completeGoogleLink(claims, transaction, input.sessionToken);
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
          throw new ForbiddenError(ACCOUNT_SUSPENDED, { code: 'ACCOUNT_SUSPENDED' });
        }

        if (isSeatSuspended(existing.user.roles, 'DEALER')) {
          throw new ForbiddenError(DEALERSHIP_SUSPENDED, { code: 'ACCOUNT_SUSPENDED' });
        }

        userId = existing.userId;
        try {
          await withDealerEmailConflict(() =>
            prisma.oAuthIdentity.update({
              where: { id: existing.id },
              data: {
                email: claims.email,
                emailVerified: claims.emailVerified,
                displayName: claims.name ?? existing.displayName,
                pictureUrl: claims.picture ?? existing.pictureUrl,
                lastLoginAt: new Date(),
              },
            }),
          );
        } catch (error) {
          if (!(error instanceof ConflictError) || error.code !== 'DEALER_EMAIL_TAKEN') throw error;
          await prisma.oAuthIdentity.update({
            where: { id: existing.id },
            data: { lastLoginAt: new Date() },
          });
          await audit.recordDetached({
            actorType: 'DEALER',
            actorId: userId,
            action: 'auth.identity.email_update_blocked',
            entityType: 'User',
            entityId: userId,
            after: { reason: 'conflicting_primary_dealer_identity' },
          });
        }
        await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
      } else {
        userId = await identities.createWithGoogle(claims);
      }

      const destination = await resolveDealerPostAuthDestination(
        prisma,
        userId,
        transaction.returnTo,
      );

      await ensureSeat(prisma, { userId, role: 'DEALER' });

      const session = await sessions.issue({
        userId,
        scope: 'DEALER',
        ip: input.ip,
        userAgent: input.userAgent,
      });

      logger.info(
        { event: 'auth.session.created', scope: 'DEALER', method: 'GOOGLE', userId },
        'dealer session created',
      );

      return {
        token: session.token,
        expiresAt: session.expiresAt,
        audience: 'DEALER',
        next: destination.next,
        returnTo: destination.returnTo,
      };
    },

    async onboard(principal: PendingPrincipal, input: OnboardingInput): Promise<AuthSession> {
      const linked = await identities.identitiesOf(principal.userId);
      if (!linked.google) {
        throw new DomainError('ONBOARDING_IDENTITY_INCOMPLETE', IDENTITY_INCOMPLETE, {
          errors: [
            {
              field: 'identity.google',
              code: 'ONBOARDING_IDENTITY_INCOMPLETE',
              message: 'Link your Google account.',
            },
          ],
        });
      }
      const email = normaliseDealerEmail(linked.google.email);

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

      const created = await withDealerEmailConflict(() =>
        withTransaction(prisma, async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${principal.userId}::uuid FOR UPDATE`;
          const currentUser = await tx.user.findUniqueOrThrow({
            where: { id: principal.userId },
            include: { roles: true },
          });
          if (currentUser.status !== 'ACTIVE' || isSeatSuspended(currentUser.roles, 'DEALER')) {
            throw new ForbiddenError(ACCOUNT_SUSPENDED, { code: 'ACCOUNT_SUSPENDED' });
          }
          await assertPhoneVerified(tx, principal.userId, phone, 'body.phone');
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

          const location = await resolveOnboardingLocation(tx, state, district);
          const dealer = await tx.dealer.create({
            data: {
              slug: await uniqueDealerSlug(tx, {
                legalName: input.legalName,
                city,
                district: location.district,
                state: location.state,
              }),
              brandName: input.legalName,
              legalName: input.legalName,
              status: 'DRAFT',
              city,
              ...location,
              addressLine: input.addressLine,
              pincode: input.pincode,
              mapsUrl: input.mapsUrl,
              lat: place.coordinates?.lat ?? null,
              lng: place.coordinates?.lng ?? null,
              mapsPlaceId: place.placeId,
              contactPhone: phone,
              contactEmail: email,
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
        }),
      );

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

  async function assertLinkSession(
    transaction: OAuthTransaction,
    sessionToken: string | undefined,
  ): Promise<string> {
    const session = await sessions.resolve(sessionToken, 'DEALER');
    if (!session || !transaction.linkUserId || session.userId !== transaction.linkUserId) {
      logger.warn(
        { event: 'auth.oauth.failed', audience: 'LINK', reason: 'session-mismatch' },
        'google link completed without the session that started it',
      );
      throw new UnauthorizedError(LINK_SESSION_MISMATCH, { code: 'LINK_SESSION_MISMATCH' });
    }
    return session.userId;
  }

  async function completeGoogleLink(
    claims: OAuthClaims,
    transaction: OAuthTransaction,
    sessionToken: string | undefined,
  ): Promise<CallbackResult> {
    const userId = await assertLinkSession(transaction, sessionToken);
    const { merged } = await identities.absorbGoogleHolder(userId, claims);
    const { linked } = await identities.linkGoogle(userId, claims);

    logger.info(
      { event: 'auth.identity.linked', provider: 'GOOGLE', userId, linked, merged },
      'google account linked',
    );

    const destination = await resolveDealerPostAuthDestination(
      prisma,
      userId,
      transaction.returnTo,
    );

    return {
      token: null,
      expiresAt: null,
      audience: 'LINK',
      next: destination.next,
      returnTo: transaction.returnTo,
    };
  }

  async function completeAdminGoogle(
    claims: OAuthClaims,
    transaction: OAuthTransaction,
    input: { ip?: string | undefined; userAgent?: string | undefined },
  ): Promise<CallbackResult> {
    const email = claims.email.trim().toLowerCase();
    const allowlisted = isAllowlistedAdmin(email);

    const identity = await prisma.oAuthIdentity.findUnique({
      where: { provider_providerSubject: { provider: 'GOOGLE', providerSubject: claims.subject } },
      include: { user: { include: { adminMember: true } } },
    });
    const byEmail = identity
      ? null
      : await prisma.user.findUnique({ where: { email }, include: { adminMember: true } });
    const known = identity?.user ?? byEmail;
    const member = known?.adminMember ?? null;

    const disabled = member?.status === 'DISABLED';
    const invited = member?.source === 'INVITED' && !disabled;
    if (!claims.emailVerified || disabled || (!allowlisted && !invited)) {
      const reason = !claims.emailVerified
        ? 'EMAIL_UNVERIFIED'
        : disabled
          ? 'MEMBER_DISABLED'
          : 'NOT_A_MEMBER';
      logger.warn({ event: 'admin.login.failure', reason }, 'admin sign-in refused');
      await audit.recordDetached({
        actorType: 'SYSTEM',
        action: 'admin.login.failure',
        entityType: 'User',
        entityId: known?.id ?? 'unknown',
        after: { email, reason },
      });
      if (reason === 'MEMBER_DISABLED') {
        throw new ForbiddenError('Your admin access has been withdrawn.', {
          code: 'ADMIN_ACCESS_REVOKED',
        });
      }
      throw new ForbiddenError(
        'That Google account is not authorised for the Dealers-Drive admin console.',
        { code: 'ADMIN_NOT_ALLOWLISTED' },
      );
    }

    if (known && known.status !== 'ACTIVE') {
      throw new ForbiddenError('This account has been suspended. Contact support.', {
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    const now = new Date();

    const admin = await withTransaction(prisma, async (tx) => {
      const user =
        known ??
        (await tx.user.create({
          data: { email, emailVerifiedAt: now, fullName: claims.name ?? null },
        }));

      await tx.user.update({
        where: { id: user.id },
        data: {
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
            userId: user.id,
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

      const current = await tx.adminMember.findUnique({ where: { userId: user.id } });
      const bootstrap = allowlisted && (!current || current.source === 'BOOTSTRAP');
      const activating =
        current?.status === 'INVITED' || (bootstrap && current?.status !== 'ACTIVE');

      const saved = current
        ? await tx.adminMember.update({
            where: { id: current.id },
            data: {
              ...(bootstrap ? { role: 'SUPER_ADMIN', status: 'ACTIVE' } : {}),
              ...(activating ? { status: 'ACTIVE', activatedAt: now } : {}),
              lastLoginAt: now,
            },
          })
        : await tx.adminMember.create({
            data: {
              userId: user.id,
              role: 'SUPER_ADMIN',
              status: 'ACTIVE',
              source: 'BOOTSTRAP',
              activatedAt: now,
              lastLoginAt: now,
            },
          });

      await syncLegacyAdminColumns(tx, {
        userId: user.id,
        role: saved.role,
        status: saved.status,
        grantedBy: saved.invitedBy,
      });

      if (activating) {
        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: user.id,
          action: 'admin_member.activated',
          entityType: 'AdminMember',
          entityId: saved.id,
          before: { status: current?.status ?? null },
          after: { status: 'ACTIVE', role: saved.role, via: 'FIRST_SIGN_IN' },
        });
      }

      return { user, member: saved };
    });

    if (!isAdmitted({ email, status: 'ACTIVE', member: admin.member })) {
      throw new ForbiddenError(
        'That Google account is not authorised for the Dealers-Drive admin console.',
        { code: 'ADMIN_NOT_ALLOWLISTED' },
      );
    }

    const session = await sessions.issue({
      userId: admin.user.id,
      scope: 'ADMIN',
      ip: input.ip,
      userAgent: input.userAgent,
    });

    logger.info(
      { event: 'admin.login.success', userId: admin.user.id, adminMemberId: admin.member.id },
      'admin signed in',
    );
    await audit.recordDetached({
      actorType: 'ADMIN',
      actorId: admin.user.id,
      action: 'admin.login.success',
      entityType: 'User',
      entityId: admin.user.id,
      after: { adminMemberId: admin.member.id, role: admin.member.role },
    });

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      audience: 'ADMIN',
      next: 'DASHBOARD',
      returnTo:
        transaction.returnTo === DEFAULT_RETURN_TO.ADMIN
          ? adminHomeFor(admin.member.role)
          : transaction.returnTo,
    };
  }
}

export type AuthService = ReturnType<typeof createAuthService>;
