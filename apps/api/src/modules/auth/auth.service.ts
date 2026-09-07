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
import { permissionsForRole, type DealerPrincipal, type PendingPrincipal } from './session.port.js';
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
 *  3. **Admins are a separate world.** Same provider now — an admin signs in
 *     with Google like everybody else — but a different session scope, a
 *     different lifetime, and no path between the two. What separates them is
 *     `ADMIN_ALLOWLIST`: a verified address that is not on it gets a dealer
 *     session and a closed door, never an admin one.
 */
export interface AuthDeps {
  prisma: PrismaClient;
  sessions: SessionService;
  oauth: OAuthProvider;
  dealers: DealersService;
  audit: AuditService;
  /** Where the new yard is, out of the link the dealer pastes on step 2. */
  maps: MapsPort;
}

export interface CallbackResult {
  token: string;
  expiresAt: Date;
  /** Which console the session is for — it decides where a failure sends the browser. */
  audience: OAuthAudience;
  next: AuthSession['next'];
  returnTo: string;
}

export function createAuthService({ prisma, sessions, oauth, dealers, audit, maps }: AuthDeps) {
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
          adminStartUrl: `${env.API_BASE_URL}/v1/auth/admin/google/start`,
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
    startGoogle(
      returnTo: string | undefined,
      audience: OAuthAudience = 'DEALER',
    ): {
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

      // The audience came out of the sealed cookie this browser was given at
      // `/start`, never off the callback URL — so a dealer sign-in cannot be
      // turned into an admin one by editing a query parameter on the way back.
      if (transaction.audience === 'ADMIN') {
        return await completeAdminGoogle(claims, transaction, input);
      }

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
        audience: 'DEALER',
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
      // Case and spacing settled once, on the way in. Everything downstream —
      // the uniqueness read below, the index behind it, the admin console's
      // city filter — then compares the same string rather than five spellings
      // of one town.
      const city = normaliseLocality(input.city);
      const district = normaliseLocality(input.district);
      const state = normaliseLocality(input.state);

      /**
       * One registered name per city.
       *
       * The unique index on `(legalName, city)` is the real guarantee — this
       * read is what turns it into a message against the two fields the dealer
       * just typed, and it compares case-insensitively because "Sri Lakshmi
       * Motors" and "SRI LAKSHMI MOTORS" in one town are the same business
       * applying twice.
       *
       * Scoped to the city rather than global, because the same name in
       * another town is a different family's business, not a collision.
       */
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

      // The yard's pin, out of the link the dealer just pasted. Best-effort and
      // bounded, and read *before* the transaction opens: an interactive
      // transaction's budget is wall-clock, and a request to Google is not
      // something to spend it on. See `platform/maps/maps-link.ts`.
      const geo = await maps.coordinatesFor(input.mapsUrl);

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
            // Name *and* place. The slug is the portfolio's URL and the name of
            // the dealership's folder in object storage, and both are read by
            // people — see `dealerSlug` in the contracts package.
            slug: await uniqueSlug({ legalName: input.legalName, city, district, state }),
            // One name, asked for once. `brandName` is the display mirror —
            // written here, and only ever by the server (`UpdateDealerInput`
            // does not carry it).
            brandName: input.legalName,
            legalName: input.legalName,
            // DRAFT, always. Becoming ACTIVE is the admin's decision, reached
            // through `POST /v1/dealer/submit` and the moderation queue — never
            // by a field on this request (CLAUDE.md rule 5).
            status: 'DRAFT',
            city,
            district,
            state,
            addressLine: input.addressLine,
            pincode: input.pincode,
            // Stored exactly as pasted. The host was checked by the schema;
            // what is inside the link is Google's business, and rewriting it
            // would break the short links the Share sheet produces.
            mapsUrl: input.mapsUrl,
            // Read out of that link, not geocoded from the address above. Null
            // when it could not be read, which is a portfolio without a map
            // rather than a portfolio with the wrong one.
            lat: geo?.lat ?? null,
            lng: geo?.lng ?? null,
            contactPhone: phone,
            contactEmail: principal.email,
            landline: input.landline ?? null,
            // Required by the schema, so this is never '' and never absent.
            // The column stays nullable for the rows that predate the
            // question — `completeness` is what names those.
            about: input.about,
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

  /**
   * B7 — the admin console's sign-in, which is now the same round trip as the
   * dealer's with one extra question asked of it.
   *
   * The question is the whole authorization model: **is this verified address
   * on `ADMIN_ALLOWLIST`?** Note what it is asked about — `claims.email`, out of
   * a token Google signed seconds ago — and not about anything a client sent, a
   * column on a row, or the address a session once had. A refusal here is a
   * refusal to *issue*; `resolveAdmin` asks the same question again on every
   * subsequent request, so taking a name off the list closes a console that is
   * already open rather than waiting twelve hours for it to expire.
   *
   * The account-linking rule that `createIdentity` enforces is deliberately
   * relaxed for exactly these addresses. There, an existing user row with no
   * linked identity is a refusal, because a matching email string is not proof
   * that the same person still holds it. Here the platform team wrote the
   * address into its own deployment configuration, which is a stronger claim
   * than the email match — and without the relaxation the seeded admin row and
   * the Google identity could never be joined at all.
   */
  async function completeAdminGoogle(
    claims: OAuthClaims,
    transaction: OAuthTransaction,
    input: { ip?: string | undefined; userAgent?: string | undefined },
  ): Promise<CallbackResult> {
    const email = claims.email.trim().toLowerCase();

    if (!isAllowlistedAdmin(email)) {
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
      include: { user: true },
    });

    if (identity && identity.user.status !== 'ACTIVE') {
      throw new ForbiddenError('This account has been suspended. Contact support.', {
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    const now = new Date();

    const admin = await withTransaction(prisma, async (tx) => {
      // By `sub` first, by address second. The subject is what does not move
      // when somebody renames their Google account; the address is only how a
      // row seeded before this flow existed is found the first time.
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
          // Only ever *granted*, never downgraded: an admin the platform team
          // has narrowed to MODERATOR by hand must not be widened back to
          // SUPER_ADMIN by the act of signing in.
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

  /**
   * `Sri Lakshmi Motors` in Katpadi →
   * `sri-lakshmi-motors-katpadi-vellore-tamil-nadu`, `-2` if that is taken.
   *
   * With the place in it a collision is rare — it now takes two dealerships of
   * the same registered name in the same town, which the `(legalName, city)`
   * unique index has already refused by the time this runs. The suffix stays
   * for the case that index cannot see: a dealership that was renamed, or one
   * whose town was corrected, leaving its old slug behind.
   */
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
