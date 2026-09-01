import {
  formatPhone,
  slugify,
  toE164,
  type AdminSessionResponse,
  type AuthProvidersResponse,
  type AuthSession,
  type OnboardingInput,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import {
  ConfigurationError,
  ConflictError,
  DomainError,
  ForbiddenError,
  UnauthorizedError,
} from '../../platform/errors.js';
import { logger } from '../../platform/telemetry/logger.js';
import type { DealersService } from '../dealers/dealers.facade.js';
import type { OAuthProvider } from './oauth.port.js';
import {
  createOAuthTransaction,
  sealTransaction,
  safeReturnTo,
  OAUTH_TRANSACTION_TTL_SECONDS,
  type OAuthTransaction,
} from './oauth-transaction.js';
import { hashPassword, verifyDecoy, verifyPassword } from './password.js';
import {
  permissionsForAdminRole,
  permissionsForRole,
  type DealerPrincipal,
  type PendingPrincipal,
} from './session.port.js';
import type { SessionService } from './session.service.js';

/**
 * Sign-in, sign-up and sign-out — the whole of Part B.
 *
 * Three claims this file has to keep true:
 *
 *  1. **Identity is established here, never accepted.** No method takes an email
 *     as an argument and returns a session. `completeGoogle` takes an
 *     authorization code and a sealed transaction cookie, and the only email it
 *     will ever act on is the one Google put in a token it signed.
 *  2. **A dealership is created by onboarding, not by signing in.** A verified
 *     Google account with no `DealerMember` row is a `PendingPrincipal`: a real
 *     session that can reach exactly one endpoint.
 *  3. **Admins are a separate world.** Different credential, different session
 *     scope, different lifetime, and no path between the two.
 */
export interface AuthDeps {
  prisma: PrismaClient;
  sessions: SessionService;
  oauth: OAuthProvider;
  dealers: DealersService;
  audit: AuditService;
}

/** §8.1 — 5 admin sign-in attempts per email per 15 minutes. */
export const ADMIN_LOGIN_LIMIT = 5;
export const ADMIN_LOGIN_WINDOW_SECONDS = 900;

export interface CallbackResult {
  token: string;
  expiresAt: Date;
  next: AuthSession['next'];
  returnTo: string;
}

export function createAuthService({ prisma, sessions, oauth, dealers, audit }: AuthDeps) {
  /**
   * The Google account on a session — for the onboarding screen, which shows
   * the verified address rather than asking for it again.
   */
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

  /**
   * B4. One shape for both states — with a dealership and without one — so a
   * client has one thing to read and one field to branch on.
   */
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
        roleTitle: null,
        phone: principal.phone ?? '',
        phoneDisplay: principal.phone ? formatPhone(principal.phone) : '',
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
          reason: enabled
            ? null
            : 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set on the API.',
        },
      };
    },

    /**
     * Step one: mint the transaction, hand back where to send the browser.
     *
     * `state`, `nonce` and the PKCE verifier are generated here and sealed into
     * a cookie the caller sets. Nothing about this request influences them.
     */
    startGoogle(returnTo: string | undefined): {
      authorizationUrl: string;
      cookie: string;
      maxAgeSeconds: number;
    } {
      if (!oauth.isConfigured()) {
        // The one error in this module written for a developer rather than a
        // dealer: it names the variables and the redirect URI to register.
        throw new ConfigurationError(
          'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in ' +
            `.env, and register ${env.GOOGLE_CALLBACK_URL} as an authorized redirect URI on the ` +
            'OAuth 2.0 client in the Google Cloud console.',
          { code: 'OAUTH_NOT_CONFIGURED' },
        );
      }

      const transaction = createOAuthTransaction(safeReturnTo(returnTo));

      logger.info({ event: 'auth.oauth.started', provider: 'GOOGLE' }, 'oauth started');

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

    /**
     * Step two: verify the round trip, find or create the person, issue a
     * session.
     *
     * The state check comes first and compares what Google echoed back against
     * what this browser was given. A callback with no cookie, a stale cookie or
     * somebody else's state is refused before the code is worth anything.
     */
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

      logger.info(
        { event: 'auth.oauth.verified', provider: 'GOOGLE', subject: claims.subject },
        'oauth identity verified',
      );

      const existing = await prisma.oAuthIdentity.findUnique({
        where: {
          provider_providerSubject: { provider: 'GOOGLE', providerSubject: claims.subject },
        },
        include: { user: true },
      });

      let userId: string;

      if (existing) {
        if (existing.user.status !== 'ACTIVE') {
          throw new ForbiddenError('This account has been suspended. Contact support.', {
            code: 'ACCOUNT_SUSPENDED',
          });
        }

        userId = existing.userId;
        await prisma.oAuthIdentity.update({
          where: { id: existing.id },
          data: {
            // Refreshed, never looked up by: the account is the `sub`.
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
        next,
        returnTo: next === 'ONBOARDING' ? '/dealer/onboarding' : transaction.returnTo,
      };
    },

    /**
     * Onboarding — one transaction that turns a verified person into a tenant:
     * the user's own details, the dealership in DRAFT, the OWNER membership and
     * the three KYC rows the review screen expects.
     *
     * Deliberately refused for anyone who already has a dealership. A second
     * call must not be able to create a second tenant under one session.
     */
    async onboard(principal: PendingPrincipal, input: OnboardingInput): Promise<AuthSession> {
      const city = await prisma.city.findUnique({ where: { slug: input.citySlug } });
      if (!city) {
        throw new DomainError('UNKNOWN_CITY', 'Choose a city from the list.', {
          errors: [{ field: 'body.citySlug', code: 'UNKNOWN_CITY', message: 'Unknown city.' }],
        });
      }

      const phone = toE164(input.phone);
      const phoneOwner = await prisma.user.findUnique({ where: { phone } });
      if (phoneOwner && phoneOwner.id !== principal.userId) {
        throw new ConflictError(
          'PHONE_ALREADY_REGISTERED',
          'That mobile number is already registered to another dealership.',
          {
            errors: [
              {
                field: 'body.phone',
                code: 'PHONE_ALREADY_REGISTERED',
                message: 'Already registered.',
              },
            ],
          },
        );
      }

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
          data: {
            fullName: input.fullName,
            roleTitle: input.roleTitle ?? null,
            phone,
          },
        });

        const dealer = await tx.dealer.create({
          data: {
            slug: await uniqueSlug(input.brandName),
            brandName: input.brandName,
            legalName: input.legalName,
            // DRAFT, always. Becoming ACTIVE is the admin's decision, reached
            // through `POST /v1/dealer/submit` and the moderation queue — never
            // by a field on this request (CLAUDE.md rule 5).
            status: 'DRAFT',
            cityId: city.id,
            addressLine: input.addressLine,
            pincode: input.pincode,
            lat: city.lat,
            lng: city.lng,
            contactPhone: phone,
            contactEmail: principal.email,
            landline: input.landline ?? null,
            specialities: [],
          },
        });

        await tx.dealerMember.create({
          data: { dealerId: dealer.id, userId: principal.userId, role: 'OWNER', permissions: [] },
        });

        // One statement, not three. Every statement inside an interactive
        // transaction is a round-trip, and the transaction budget is wall-clock:
        // three sequential creates spend three of them on rows that have no
        // dependency on each other.
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

      // The principal the *next* request will resolve to, built here so the
      // response body is the same shape `GET /v1/auth/me` would return — right
      // down to the permissions the new OWNER seat carries.
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

    /**
     * `userId` is for the log line only — the token decides which row is
     * revoked, so a caller cannot sign anybody else out by naming them.
     */
    async logout(token: string | undefined, userId?: string): Promise<void> {
      await sessions.revoke(token);
      logger.info({ event: 'auth.session.revoked', userId: userId ?? null }, 'session revoked');
    },

    /**
     * B7 — the admin console's sign-in.
     *
     * Every failure answers with the same message and the same status. "No such
     * account" and "wrong password" are indistinguishable from outside, and the
     * decoy verification keeps them indistinguishable in timing too.
     */
    async adminLogin(input: {
      email: string;
      password: string;
      ip?: string | undefined;
      userAgent?: string | undefined;
    }): Promise<{ token: string; expiresAt: Date; response: AdminSessionResponse }> {
      const email = input.email.trim().toLowerCase();
      const user = await prisma.user.findFirst({
        where: { email, isPlatformAdmin: true },
      });

      const ok = user?.passwordHash
        ? await verifyPassword(user.passwordHash, input.password)
        : await verifyDecoy(input.password);

      if (!ok || !user?.adminRole || user.status !== 'ACTIVE') {
        logger.warn({ event: 'admin.login.failure', email }, 'admin sign-in refused');
        await audit.recordDetached({
          actorType: 'SYSTEM',
          action: 'admin.login.failure',
          entityType: 'User',
          entityId: user?.id ?? 'unknown',
          after: { email },
        });
        throw new UnauthorizedError('That email and password do not match.', {
          code: 'INVALID_CREDENTIALS',
        });
      }

      const session = await sessions.issue({
        userId: user.id,
        scope: 'ADMIN',
        ip: input.ip,
        userAgent: input.userAgent,
      });

      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

      logger.info({ event: 'admin.login.success', userId: user.id }, 'admin signed in');
      await audit.recordDetached({
        actorType: 'ADMIN',
        actorId: user.id,
        action: 'admin.login.success',
        entityType: 'User',
        entityId: user.id,
      });

      return {
        token: session.token,
        expiresAt: session.expiresAt,
        response: {
          admin: {
            id: user.id,
            email: user.email ?? email,
            fullName: user.fullName,
            adminRole: user.adminRole,
          },
          permissions: permissionsForAdminRole(user.adminRole),
          sessionExpiresAt: session.expiresAt.toISOString(),
        },
      };
    },
  };

  /**
   * A first sign-in.
   *
   * The refusal in the middle is the account-linking policy, written out: an
   * email that already belongs to an account is *not* enough to take it over.
   * Google verifying `owner@example.com` today says nothing about who held that
   * address when the dealership was created, and silently merging on a matching
   * string is how an expired domain becomes somebody else's inventory.
   */
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
          // Google is the verifier. There is no separate email round trip, and
          // no OTP: the identity token *is* the proof.
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

  /** `Sri Lakshmi Motors` → `sri-lakshmi-motors`, `-2` if that is taken. */
  async function uniqueSlug(brandName: string): Promise<string> {
    const base = slugify(brandName).slice(0, 60) || 'dealership';

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const taken = await prisma.dealer.findUnique({ where: { slug: candidate } });
      if (!taken) return candidate;
    }

    throw new ConflictError('SLUG_UNAVAILABLE', 'Could not derive a unique address for that name.');
  }
}

export type AuthService = ReturnType<typeof createAuthService>;

/** Re-exported so the seed hashes passwords the same way sign-in verifies them. */
export { hashPassword };
