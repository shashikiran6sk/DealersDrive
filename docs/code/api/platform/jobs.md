# api / platform/jobs

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/platform/jobs/queue.ts`

### `export interface Queue`

pg-boss on the database we already run: real queue semantics — retries,
backoff, scheduling, dead-lettering, priorities — with zero new
infrastructure and transactional enqueue (ARCHITECTURE §19.1).

`JOBS_ENABLED=false` swaps in a queue that runs handlers inline. The
integration suite uses it so a test never waits on a poller, and so the
suite needs no background schema.

### `'notification.email'`

**R40.** One name for every email, and the payload says which.

The alternative — a queue per template — was considered and is worse in
both directions: eight queues to create, poll, monitor and drain, and a
ninth the day somebody adds a message. What a queue name is _for_ is
separating work with different shapes: a different concurrency, a
different retry budget, a different priority. Eight transactional emails
have none of that; they are one kind of work with eight bodies.

### `const PRIORITIES: Partial<Record<JobName, number>> =`

Highest priority is the lead notification. It is the product (§14.5).

### `const RETRY: Partial<Record<JobName, { retryLimit: number; retryDelay: number }>> =`

How hard a job tries before it is somebody's problem (**R40**).

Five attempts with exponential backoff is roughly twenty minutes of trying,
which covers the failure this is actually for: a provider having a bad
minute. Beyond that the fault is not transient — an unverified domain, a
revoked key — and a sixth attempt is twenty more minutes of pretending
otherwise. `notification_deliveries` carries the `FAILED` row and the
provider's own sentence for what happens next.

### `const pending: { name: JobName; handler: (data: Record<string, unknown>) => Promise<void> }[] =`

Handlers registered before `start()`; pg-boss v12 needs the queue to exist.

### `export function createInlineQueue(): Queue`

Runs every handler synchronously at send time. Deliberately not "fire and
forget": a test that submits a listing must be able to assert on what the
subscriber wrote, on the next line, without a sleep.
