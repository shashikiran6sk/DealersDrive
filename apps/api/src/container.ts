import type { PrismaClient } from '@prisma/client';

import { env, type Env } from './config/env.js';
import type { CachePort } from './platform/cache/cache.port.js';
import { createCache } from './platform/cache/factory.js';
import { createPrisma, installBigIntJson } from './platform/db/prisma.js';

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
}

export interface ContainerOverrides {
  /** Widens as the seams arrive: sessions at F015, oauth at F018, cache at F028. */
  readonly env?: Env;
  readonly prisma?: PrismaClient;
  /** The integration suite pins this to memory so windows reset with the process. */
  readonly cache?: CachePort;
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

  return { env: overrides.env ?? env, prisma, cache };
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
