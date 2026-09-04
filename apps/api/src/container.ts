import type { PrismaClient } from '@prisma/client';

import { env, type Env } from './config/env.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createRateLimiter, type RateLimiter } from './middleware/rate-limit.js';
import { createAdminService, type AdminService } from './modules/admin/admin.service.js';
import { createAuthService, type AuthService } from './modules/auth/auth.service.js';
import { createCookieSessionResolver } from './modules/auth/cookie-session.adapter.js';
import { createConfigService, type ConfigService } from './modules/config/config.service.js';
import { createDevSessionResolver } from './modules/auth/dev-session.adapter.js';
import { createGoogleOAuthProvider } from './modules/auth/google.provider.js';
import type { OAuthProvider } from './modules/auth/oauth.port.js';
import type { SessionResolver } from './modules/auth/session.port.js';
import { createSessionService, type SessionService } from './modules/auth/session.service.js';
import { createDealersRepository } from './modules/dealers/dealers.repository.js';
import { createLocationsRepository } from './modules/locations/locations.repository.js';
import { createMediaService, type MediaService } from './modules/media/media.service.js';
import {
  createLocationsService,
  emptyIndex,
  type LocationsService,
} from './modules/locations/locations.service.js';
import { createDealersService, type DealersService } from './modules/dealers/dealers.service.js';
import { createAuditService } from './platform/audit/audit.service.js';
import {
  createPlatformConfig,
  type PlatformConfigService,
} from './platform/config/platform-config.js';
import type { CachePort } from './platform/cache/cache.port.js';
import { createCache } from './platform/cache/factory.js';
import { createPrisma, installBigIntJson } from './platform/db/prisma.js';
import { createEventBus, type EventBus } from './platform/events/bus.js';
import { createOutboxPublisher, type OutboxPublisher } from './platform/events/outbox-publisher.js';
import { createQueue, type Queue } from './platform/jobs/queue.js';
import { createStorage } from './platform/storage/factory.js';
import { ensureBucket } from './platform/storage/s3.adapter.js';
import type { StoragePort } from './platform/storage/storage.port.js';
import { logger } from './platform/telemetry/logger.js';

/**
 * The composition root — this replaces DI (ARCHITECTURE §5.3).
 *
 * Every dependency is constructed here, by hand, in dependency order, and
 * passed down as plain arguments. Explicit, greppable, and trivially testable:
 * pass fakes in, get a module out. Every provider seam is visible in one place,
 * and each is chosen by configuration rather than by code:
 *
 *   sessions  — `CookieSessionResolver`, or the dev identity under AUTH_MODE=dev
 *   oauth     — Google; a fake is injected by the sign-in tests
 *   storage   — local disk · MinIO · R2, by STORAGE_DRIVER
 *   cache     — process memory · Postgres, by CACHE_DRIVER
 *   sms       — console · MSG91, by SMS_DRIVER
 *   payments  — `createDevelopmentPaymentProvider` today, Razorpay later
 *   rc        — deterministic mock · Attestr, by RC_LOOKUP_DRIVER
 *
 * None of those choices reaches a module: they are all made here.
 *
 * ── Reconstruction note ───────────────────────────────────────────────────
 * F002 lands the shape and nothing else. Every field above arrives with the
 * feature that owns it — `prisma` at F005, `cache` at F028, `storage` at F032,
 * `guards` at F016, and so on — so this file is edited by nearly every API
 * feature that follows. That is expected and is why the risk register calls it
 * out; rebase rather than merge while a branch against it is open.
 */
export interface Container {
  readonly env: Env;
  readonly prisma: PrismaClient;
  /** Cross-instance shared state: rate-limit windows and the config version. */
  readonly cache: CachePort;
  /** Built here, like the guards, so no router reaches for a global counter. */
  readonly rateLimit: RateLimiter;
  /** Runtime-editable settings and `feature.*` flags, version-polled. */
  readonly config: PlatformConfigService;
  /** pg-boss, or the inline queue when `JOBS_ENABLED=false`. */
  readonly queue: Queue;
  readonly bus: EventBus;
  readonly outbox: OutboxPublisher;
  /** Local disk, MinIO or R2 — chosen by `STORAGE_DRIVER`, never by a module. */
  readonly storage: StoragePort;
  /** Reads the principal off a request. Cookie-backed, or the dev identity. */
  readonly sessions: SessionResolver;
  /** Issues, resolves and revokes the rows behind those cookies. */
  readonly sessionStore: SessionService;
  /** Google, or the fake the sign-in tests inject. */
  readonly oauth: OAuthProvider;
  /** The guard chain. `auth` below is the module that issues the sessions. */
  readonly guards: ReturnType<typeof createAuthMiddleware>;
  readonly auth: AuthService;
  readonly dealers: DealersService;
  /** The cross-tenant console. Every write it makes names the admin who made it. */
  readonly admin: AdminService;
  readonly publicConfig: ConfigService;
  readonly locations: LocationsService;
  readonly media: MediaService;
}

export interface ContainerOverrides {
  /** Widens as the seams arrive: sessions at F015, oauth at F018, cache at F028. */
  readonly env?: Env;
  readonly prisma?: PrismaClient;
  /** The integration suite pins this to memory so windows reset with the process. */
  readonly cache?: CachePort;
  readonly queue?: Queue;
  readonly storage?: StoragePort;
  /** `harness.ts` swaps the whole resolver out; `auth-harness.ts` does not. */
  readonly sessions?: SessionResolver;
  /** The seam `auth-harness.ts` uses: everything above it runs unmodified. */
  readonly oauth?: OAuthProvider;
}

/**
 * The `async` is the contract, not an accident: the handler registration this
 * awaits arrives with the features that own each handler.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- see above
export async function buildContainer(overrides: ContainerOverrides = {}): Promise<Container> {
  installBigIntJson();

  const prisma = overrides.prisma ?? createPrisma();
  const cache = overrides.cache ?? createCache(prisma);
  const rateLimit = createRateLimiter(cache);
  const config = createPlatformConfig(prisma, cache);
  const queue = overrides.queue ?? createQueue();
  const bus = createEventBus();
  const outbox = createOutboxPublisher(prisma, bus);
  const storage = overrides.storage ?? createStorage();

  const sessionStore = createSessionService(prisma);
  const sessions = overrides.sessions ?? createResolver(prisma, sessionStore);
  const guards = createAuthMiddleware(sessions);
  const oauth = overrides.oauth ?? createGoogleOAuthProvider();

  const audit = createAuditService(prisma);
  const dealersRepo = createDealersRepository(prisma);
  const dealers = createDealersService({ prisma, repo: dealersRepo, storage });
  const auth = createAuthService({ prisma, sessions: sessionStore, oauth, dealers, audit });
  const admin = createAdminService({ prisma, audit, config, storage });
  const publicConfig = createConfigService({ config });
  // `search` is the real SearchRepository from F076 onward; until the
  // `listing_search` table exists there is nothing live to count.
  const locations = createLocationsService({
    repo: createLocationsRepository(prisma),
    search: emptyIndex,
  });
  const media = createMediaService({ prisma, storage, queue });

  return {
    env: overrides.env ?? env,
    prisma,
    cache,
    rateLimit,
    config,
    queue,
    bus,
    outbox,
    storage,
    sessions,
    sessionStore,
    oauth,
    guards,
    auth,
    dealers,
    admin,
    publicConfig,
    locations,
    media,
  };
}

/**
 * `AUTH_MODE=dev` is a documented escape hatch for a developer who has not
 * registered a Google OAuth client yet, and it is loud on purpose: it replaces
 * identity verification with a server-configured identity. `env.ts` refuses it
 * in production, so this branch cannot be reached there.
 */
function createResolver(prisma: PrismaClient, sessionStore: SessionService): SessionResolver {
  if (env.AUTH_MODE === 'dev') {
    logger.warn(
      { devDealer: env.DEV_DEALER_SLUG },
      'AUTH_MODE=dev — sign-in is bypassed and every request acts as the configured dealer',
    );
    return createDevSessionResolver(prisma);
  }
  return createCookieSessionResolver(prisma, sessionStore);
}

/** Starts the background machinery. Not called by tests, which drain inline. */
export async function startBackground(container: Container): Promise<void> {
  // A fresh MinIO volume has no bucket, and the first photo upload should not be
  // the thing that discovers that.
  if (env.STORAGE_DRIVER !== 'local') {
    await ensureBucket();
    logger.info({ bucket: env.S3_BUCKET, endpoint: env.S3_ENDPOINT }, 'object storage ready');
  }

  // `registerSchedules` arrives with the handlers — see the note on
  // `handlers.ts` in the F031 feature-map entry.
  if (!env.JOBS_ENABLED) return;

  await container.queue.start();
  container.outbox.start();
}

/** Releases everything the container holds open. Called on SIGTERM. */
export async function closeContainer(container: Container): Promise<void> {
  container.outbox.stop();
  try {
    await container.queue.stop();
  } catch (error) {
    logger.warn({ err: error }, 'queue stop failed');
  }
  try {
    await container.cache.close();
  } catch (error) {
    logger.warn({ err: error }, 'cache close failed');
  }
  await container.prisma.$disconnect();
}
