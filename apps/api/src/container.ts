import type { PrismaClient } from '@prisma/client';

import { env, type Env } from './config/env.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createRateLimiter, type RateLimiter } from './middleware/rate-limit.js';
import { createCookieSessionResolver } from './modules/auth/cookie-session.adapter.js';
import { createDevSessionResolver } from './modules/auth/dev-session.adapter.js';
import type { SessionResolver } from './modules/auth/session.port.js';
import { createSessionService, type SessionService } from './modules/auth/session.service.js';
import type { CachePort } from './platform/cache/cache.port.js';
import { createCache } from './platform/cache/factory.js';
import { createPrisma, installBigIntJson } from './platform/db/prisma.js';
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
  readonly sessions: SessionResolver;
  readonly sessionStore: SessionService;
  /** The guard chain. `auth` below is the module that issues the sessions. */
  readonly guards: ReturnType<typeof createAuthMiddleware>;
}

export interface ContainerOverrides {
  /** Widens as the seams arrive: sessions at F015, oauth at F018, cache at F028. */
  readonly env?: Env;
  readonly prisma?: PrismaClient;
  /** The integration suite pins this to memory so windows reset with the process. */
  readonly cache?: CachePort;
  readonly sessions?: SessionResolver;
}

/**
 * The `async` is the contract, not an accident: F031 awaits the queue here.
 * Making it synchronous now would mean changing every call site back.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- see above
export async function buildContainer(overrides: ContainerOverrides = {}): Promise<Container> {
  installBigIntJson();

  const prisma = overrides.prisma ?? createPrisma();
  const cache = overrides.cache ?? createCache(prisma);
  const rateLimit = createRateLimiter(cache);

  const sessionStore = createSessionService(prisma);
  const sessions = overrides.sessions ?? createResolver(prisma, sessionStore);
  const guards = createAuthMiddleware(sessions);

  return { env: overrides.env ?? env, prisma, cache, rateLimit, sessions, sessionStore, guards };
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
export async function startBackground(_container: Container): Promise<void> {
  // The queue, the outbox and the bucket check arrive with F031 and F032.
}

/** Releases everything the container holds open. Called on SIGTERM. */
export async function closeContainer(container: Container): Promise<void> {
  // The queue and outbox stop ahead of this once F031 lands.
  try {
    await container.cache.close();
  } catch {
    // A cache that will not close must not stop the process from exiting.
  }
  await container.prisma.$disconnect();
}
