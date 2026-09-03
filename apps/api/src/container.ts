import { env, type Env } from './config/env.js';

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
}

export interface ContainerOverrides {
  /** Widens as the seams arrive: prisma at F005, sessions at F015, oauth at F018. */
  readonly env?: Env;
}

/**
 * The `async` is the contract, not an accident: F005 awaits the Prisma
 * connection here and F031 the queue. Making it synchronous now would mean
 * changing every call site back two features later.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- see above
export async function buildContainer(overrides: ContainerOverrides = {}): Promise<Container> {
  return { env: overrides.env ?? env };
}

/** Starts the background machinery. Not called by tests, which drain inline. */
export async function startBackground(_container: Container): Promise<void> {
  // The queue, the outbox and the bucket check arrive with F031 and F032.
}

/** Releases everything the container holds open. Called on SIGTERM. */
export async function closeContainer(_container: Container): Promise<void> {
  // Nothing is held open yet. F005 adds the Prisma disconnect.
}
