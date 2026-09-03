/**
 * The seam between the application and shared, cross-instance state.
 *
 * It exists for one reason: **process memory is not shared state.** A fixed
 * window counted in a `Map` counts one process's requests, so the moment the
 * API runs more than one task every configured limit is silently multiplied by
 * the task count. For a spend control — every phone reveal costs an SMS
 * (§9.2) — that is not a performance nuance, it is the control failing open.
 *
 * Two implementations today, chosen by `CACHE_DRIVER`:
 *
 *   memory    — a `Map` in this process. Correct for `pnpm dev`, for the test
 *               suite, and for exactly one running task. Refused in production
 *               by `env.ts`, for the reason above.
 *   postgres  — the database the API already has. No new infrastructure, no
 *               new failure domain, and `increment` is a single atomic
 *               statement rather than a read-modify-write.
 *
 * Redis is the obvious third adapter and this port is shaped to accept it
 * without a caller changing: nothing below mentions SQL, a table, a key
 * prefix or a connection. When request volume makes a counter write per
 * request worth avoiding, `createRedisCache()` is a new file and one line in
 * `factory.ts` (§18).
 */

/** The outcome of consuming one slot in a fixed window. */
export interface CounterResult {
  /** Requests seen in this window *including* the one just counted. */
  count: number;
  /** Epoch milliseconds at which the window rolls over. */
  resetAt: number;
  /** Whole seconds until `resetAt`, floored at 1 — the `Retry-After` value. */
  retryAfterSeconds: number;
}

export interface CachePort {
  /** Names the active adapter. Reported by `/health/ready`, never branched on. */
  readonly driver: 'memory' | 'postgres';

  /**
   * Atomically add one to `key`'s window, creating or rolling it over as
   * needed, and return the new count.
   *
   * Atomic is the whole requirement. Two tasks handling the sixth request of a
   * five-per-hour window must not both read 5, both decide "allowed", and both
   * write 6.
   */
  increment(key: string, windowSeconds: number): Promise<CounterResult>;

  /**
   * The current count without consuming a slot — used to decide "captcha after
   * three" rather than to allow or deny. Returns 0 for an absent or expired
   * window.
   */
  peek(key: string): Promise<number>;

  /**
   * A monotonically increasing number per namespace, used to invalidate
   * *other* instances' in-process caches.
   *
   * `PlatformConfig` holds its rows in a 5-minute local cache. Without this, an
   * admin turning a feature off waits up to five minutes for every task to
   * notice, and there is no way to make it faster. With it, the writer bumps
   * the version and every other task sees the change on its next poll (§18).
   */
  bumpVersion(namespace: string): Promise<number>;

  /** The current version for a namespace. 0 when it has never been bumped. */
  readVersion(namespace: string): Promise<number>;

  /**
   * Deletes windows that have already rolled over. Called on a schedule, not
   * on the request path — an expired row is already treated as absent, so this
   * reclaims space rather than affecting correctness.
   */
  sweep(): Promise<number>;

  /** Cheap liveness probe for `/health/ready`. Throws when the backend is down. */
  ping(): Promise<void>;

  /** Drops every counter. Test-suite affordance; never called by application code. */
  reset(): Promise<void>;

  close(): Promise<void>;
}

/**
 * Shared by both adapters so a `Retry-After` never reads `0` or a negative.
 *
 * `windowSeconds` is an upper bound rather than decoration. The Postgres
 * adapter reads `reset_at` off the *database's* clock and compares it to the
 * application's, so a node running a millisecond behind its database turns a
 * 60-second window into a 61-second wait — a header that outlives the window
 * it describes, and a test that fails once a fortnight for no reason anyone
 * can reproduce. Clamping is correct in both directions: whichever clock is
 * ahead, no caller should ever be told to wait longer than the whole window.
 */
export function retryAfterSeconds(
  resetAt: number,
  now: number = Date.now(),
  windowSeconds?: number,
): number {
  const remaining = Math.max(1, Math.ceil((resetAt - now) / 1000));
  return windowSeconds === undefined ? remaining : Math.min(remaining, windowSeconds);
}
