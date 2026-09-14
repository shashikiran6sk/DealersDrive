# api / platform/cache

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/platform/cache/cache.port.ts`

### `export interface CounterResult`

The seam between the application and shared, cross-instance state.

It exists for one reason: **process memory is not shared state.** A fixed
window counted in a `Map` counts one process's requests, so the moment the
API runs more than one task every configured limit is silently multiplied by
the task count. For a spend control — every phone reveal costs an SMS
(§9.2) — that is not a performance nuance, it is the control failing open.

Two implementations today, chosen by `CACHE_DRIVER`:

memory — a `Map` in this process. Correct for `pnpm dev`, for the test
suite, and for exactly one running task. Refused in production
by `env.ts`, for the reason above.
postgres — the database the API already has. No new infrastructure, no
new failure domain, and `increment` is a single atomic
statement rather than a read-modify-write.

Redis is the obvious third adapter and this port is shaped to accept it
without a caller changing: nothing below mentions SQL, a table, a key
prefix or a connection. When request volume makes a counter write per
request worth avoiding, `createRedisCache()` is a new file and one line in
`factory.ts` (§18).

### `export interface CounterResult`

The outcome of consuming one slot in a fixed window.

### `count: number`

Requests seen in this window _including_ the one just counted.

### `resetAt: number`

Epoch milliseconds at which the window rolls over.

### `retryAfterSeconds: number`

Whole seconds until `resetAt`, floored at 1 — the `Retry-After` value.

### `readonly driver: 'memory' | 'postgres'`

Names the active adapter. Reported by `/health/ready`, never branched on.

### `increment(key: string, windowSeconds: number): Promise<CounterResult>`

Atomically add one to `key`'s window, creating or rolling it over as
needed, and return the new count.

Atomic is the whole requirement. Two tasks handling the sixth request of a
five-per-hour window must not both read 5, both decide "allowed", and both
write 6.

### `peek(key: string): Promise<number>`

The current count without consuming a slot — used to decide "captcha after
three" rather than to allow or deny. Returns 0 for an absent or expired
window.

### `bumpVersion(namespace: string): Promise<number>`

A monotonically increasing number per namespace, used to invalidate
_other_ instances' in-process caches.

`PlatformConfig` holds its rows in a 5-minute local cache. Without this, an
admin turning a feature off waits up to five minutes for every task to
notice, and there is no way to make it faster. With it, the writer bumps
the version and every other task sees the change on its next poll (§18).

### `readVersion(namespace: string): Promise<number>`

The current version for a namespace. 0 when it has never been bumped.

### `sweep(): Promise<number>`

Deletes windows that have already rolled over. Called on a schedule, not
on the request path — an expired row is already treated as absent, so this
reclaims space rather than affecting correctness.

### `ping(): Promise<void>`

Cheap liveness probe for `/health/ready`. Throws when the backend is down.

### `reset(): Promise<void>`

Drops every counter. Test-suite affordance; never called by application code.

### `export function retryAfterSeconds`

Shared by both adapters so a `Retry-After` never reads `0` or a negative.

`windowSeconds` is an upper bound rather than decoration. The Postgres
adapter reads `reset_at` off the _database's_ clock and compares it to the
application's, so a node running a millisecond behind its database turns a
60-second window into a 61-second wait — a header that outlives the window
it describes, and a test that fails once a fortnight for no reason anyone
can reproduce. Clamping is correct in both directions: whichever clock is
ahead, no caller should ever be told to wait longer than the whole window.

## `apps/api/src/platform/cache/factory.ts`

### `export function createCache(prisma: PrismaClient): CachePort`

The shared-state provider, chosen by one variable.

memory — this process only. `pnpm dev`, the test suite, one task.
Refused in production by `env.ts` (§29), because a limit that
is N times looser than it says fails silently.
postgres — the database the API already has. The production default.

It takes the Prisma client rather than creating one: the counter write must
share the API's connection pool, not open a second one.

## `apps/api/src/platform/cache/memory.adapter.ts`

### `interface Window`

`CachePort` in process memory.

Correct for exactly one running process, which is what `pnpm dev` and the
test suite are. `env.ts` refuses this driver in production, because the
failure mode there is silent: nothing errors, every limit is simply N times
looser than the number written next to it.

Single-threaded JavaScript makes `increment` atomic for free — there is no
await between the read and the write, so no other request can interleave.

## `apps/api/src/platform/cache/postgres.adapter.ts`

### `interface CounterRow`

`CachePort` on the database the API already has.

Chosen over Redis deliberately (§18). Redis would be a second datastore to
provision, secure, monitor and pay for, in a VPC that currently contains one
— and the thing being stored is a counter that may be lost without
consequence beyond a window resetting early. Postgres is already there,
already backed up, already on the readiness check, and already the thing the
request cannot proceed without.

The cost is one small write per rate-limited request. At the current public
limit (120/min/IP) that is nothing next to the query the request is about to
run anyway. When it stops being nothing, `createRedisCache()` implements the
same port and `factory.ts` gains a branch.

### `async increment(key, windowSeconds): Promise<CounterResult>`

One statement, so it is atomic without a transaction or a row lock.

The two CASE expressions are what make the window roll over correctly
under concurrency: whichever request wins the conflict evaluates
`reset_at <= now()` against the row as it exists at that instant, so a
stale window is reset to 1 exactly once and every other concurrent
request increments the fresh one. A read-then-write in application code
cannot make that promise.

### `const resetAt = Date.now() + windowSeconds * 1000`

RETURNING on an upsert always yields a row; if it ever does not, the

### `const resetAt = Date.now() + windowSeconds * 1000`

safe reading is "we could not count this", and a limiter that cannot

### `const resetAt = Date.now() + windowSeconds * 1000`

count must not be the thing that denies a legitimate request.

### `return Promise.resolve()`

The Prisma client is owned by the container, which disconnects it.
