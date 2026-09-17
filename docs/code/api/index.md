# api / index

Parent: [api](../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/container.ts`

### `export interface Container`

The composition root — this replaces DI (ARCHITECTURE §5.3).

Every dependency is constructed here, by hand, in dependency order, and
passed down as plain arguments. Explicit, greppable, and trivially testable:
pass fakes in, get a module out. Every provider seam is visible in one place,
and each is chosen by configuration rather than by code:

sessions — `CookieSessionResolver`, or the dev identity under AUTH_MODE=dev
oauth — Google; a fake is injected by the sign-in tests
storage — local disk · MinIO · R2, by STORAGE_DRIVER
cache — process memory · Postgres, by CACHE_DRIVER
phone otp — fixed dev code · the MSG91 widget, by PHONE_OTP_DRIVER

None of those choices reaches a module: they are all made here.

── Reconstruction note ───────────────────────────────────────────────────
F002 lands the shape and nothing else. Every field above arrives with the
feature that owns it — `prisma` at F005, `cache` at F028, `storage` at F032,
`guards` at F016, and so on — so this file is edited by nearly every API
feature that follows. That is expected and is why the risk register calls it
out; rebase rather than merge while a branch against it is open.

### `readonly cache: CachePort`

Cross-instance shared state: rate-limit windows and the config version.

### `readonly rateLimit: RateLimiter`

Built here, like the guards, so no router reaches for a global counter.

### `readonly config: PlatformConfigService`

Runtime-editable settings and `feature.*` flags, version-polled.

### `readonly queue: Queue`

pg-boss, or the inline queue when `JOBS_ENABLED=false`.

### `readonly storage: StoragePort`

Local disk, MinIO or R2 — chosen by `STORAGE_DRIVER`, never by a module.

### `readonly mailer: MailerPort`

Console or Resend, by `MAIL_DRIVER` (**R40**). Held by the worker, never by a route.

### `readonly notifications: NotificationsService`

Who gets told what. Subscribes to the bus and owns the email job handler.

### `readonly sessions: SessionResolver`

Reads the principal off a request. Cookie-backed, or the dev identity.

### `readonly sessionStore: SessionService`

Issues, resolves and revokes the rows behind those cookies.

### `readonly oauth: OAuthProvider`

Google, or the fake the sign-in tests inject.

### `readonly guards: ReturnType<typeof createAuthMiddleware>`

The guard chain. `auth` below is the module that issues the sessions.

### `readonly phoneOtp: PhoneOtpPort`

Whose handset an OTP access token proves. Fake or MSG91, by `PHONE_OTP_DRIVER`.

### `readonly phone: PhoneService`

B8 — the only writer of `users.phone` (**R39**).

### `readonly dealersPublic: DealersPublicService`

The buyer-facing view of a dealership: the directory and one portfolio.

### `readonly admin: AdminService`

The cross-tenant console. Every write it makes names the admin who made it.

### `readonly env?: Env`

Widens as the seams arrive: sessions at F015, oauth at F018, cache at F028.

### `readonly cache?: CachePort`

The integration suite pins this to memory so windows reset with the process.

### `readonly mailer?: MailerPort`

The seam the notification tests use — a mailer that records instead of sending.

### `readonly sessions?: SessionResolver`

`harness.ts` swaps the whole resolver out; `auth-harness.ts` does not.

### `readonly oauth?: OAuthProvider`

The seam `auth-harness.ts` uses: everything above it runs unmodified.

### `readonly phoneOtp?: PhoneOtpPort`

The MSG91 seam (**R39**) — a fake verdict, with no network and no widget.

### `export async function buildContainer(overrides: ContainerOverrides = {}): Promise<Container>`

The `async` is the contract, not an accident: the handler registration this
awaits arrives with the features that own each handler.

### `const dealersPublic = createDealersPublicService({ repo: dealersRepo, stats: noInventoryYet })`

`noInventoryYet` is the car-count source until **F076**. The baseline read
`search.dealerStats()`, which groups `listing_search` — the read model F064
creates. Nothing creates a listing yet, so every dealership genuinely has
none, and the directory already renders that case with an em dash. F076
replaces this argument and nothing else.

### `const notifications = createNotificationsService({ prisma, queue, mailer })`

Built here, subscribed in `startBackground` (**R40**). Constructing it is
free; _subscribing_ it is what decides which process turns an outbox row
into an email, and that is a deployment question rather than a wiring one.

### `function createResolver(prisma: PrismaClient, sessionStore: SessionService): SessionResolver`

`AUTH_MODE=dev` is a documented escape hatch for a developer who has not
registered a Google OAuth client yet, and it is loud on purpose: it replaces
identity verification with a server-configured identity. `env.ts` refuses it
in production, so this branch cannot be reached there.

### `export async function startBackground(container: Container): Promise<void>`

Starts the background machinery. Not called by tests, which drain inline.

── One image, two process types (R40) ──────────────────────────────────────
`WORKER_INLINE=true` — the default, and what `pnpm dev` and a one-box
deployment use — runs the outbox publisher and the job handlers in the HTTP
process, so the whole product is one command.

`WORKER_INLINE=false` makes this a **pure API**: it still writes outbox rows
inside its transactions, and it neither drains them nor holds a mailer. A
separate `src/worker.ts` process does that, and `startWorker` below is what
it calls. That split is the point of this revision — the API's tail latency
stops depending on whether Resend is having a good afternoon, and it can be
scaled to N tasks without N copies of every scheduled job firing.

### `if (env.STORAGE_DRIVER !== 'local')`

A fresh MinIO volume has no bucket, and the first photo upload should not be

### `if (env.STORAGE_DRIVER !== 'local')`

the thing that discovers that.

### `if (!env.JOBS_ENABLED) return`

`registerSchedules` arrives with the handlers — see the note on

### `if (!env.JOBS_ENABLED) return`

`handlers.ts` in the F031 feature-map entry.

### `if (!env.WORKER_INLINE)`

The API only drains the outbox and works the queue when it is _also_ the
worker. Under `WORKER_INLINE=false` it has written its rows and its job is
done — anything else would be two processes racing for the same jobs, which
`FOR UPDATE SKIP LOCKED` makes safe and duplicated effort makes pointless.

### `export async function startWorker(container: Container): Promise<void>`

The background half, wherever it runs (**R40**).

Called by `startBackground` when `WORKER_INLINE=true`, and by `worker.ts`
when it is false. One function, so the two deployments cannot drift into
running different handlers — a worker that subscribed to five of the six
events would be a bug nobody notices until a dealer is not told something.

### `export async function closeContainer(container: Container): Promise<void>`

Releases everything the container holds open. Called on SIGTERM.

## `apps/api/src/index.ts`

### `devDealer: env.DEV_DEALER_SLUG`

`cache: container.cache.driver` returns with F028, which builds it.

### `server.keepAliveTimeout = 61_000`

Keep-alive is what makes the drain below actually drain.

`server.close()` stops accepting _new_ connections but waits for existing
ones to end, and an idle keep-alive connection does not end on its own.
Node 19+ closes idle ones on `close()`, but a client that is between requests
on a busy connection can still hold the server open past the budget — so the
timeouts are set explicitly rather than left to the platform default.

### `function shutdown(signal: string): void`

Shutdown, in two phases (§20.10).

1. Fail readiness, keep serving. `/health/ready` answers 503 the instant
   the signal arrives, and we then do nothing for SHUTDOWN_DRAIN_MS. That
   pause is the load balancer's chance to notice and stop routing new
   requests here. Closing the listener first is what produces the
   connection resets that make a normal deploy look like an outage.
2. Close, then release. Stop accepting connections, let the in-flight
   requests finish, then shut the queue, the outbox and the database pool.

The whole thing is bounded by SHUTDOWN_TIMEOUT_MS. Exceeding it exits
non-zero rather than hanging a deployment for ECS's stopTimeout.

### `if (env.SHUTDOWN_DRAIN_MS > 0) await delay(env.SHUTDOWN_DRAIN_MS)`

Phase 1 — deliberately doing nothing, so the target group can react.

### `if (env.SHUTDOWN_DRAIN_MS > 0) await delay(env.SHUTDOWN_DRAIN_MS)`

Zero outside production: nothing is load-balancing `pnpm dev`.

### `const closeError = await new Promise<Error | undefined>((resolve) =>`

Phase 2 — stop listening, then wait out the in-flight requests.

## `apps/api/src/routes.ts`

### `export function createRoutes(container: Container): Router`

Every module router is mounted here and nowhere else — one file to read to
know the entire surface area of the API.

The mount points carry different guard chains, and that is the whole
authorization model at a glance:

/v1/… public, IP rate-limited, no principal
/v1/auth/… mixed, and the only mount where that is true — sign-in has
to be reachable without a session, and `/me` must not be
/v1/dealer/… requireDealer — dealerId enters the request context here
/v1/admin/… requireAdmin

Health lives outside /v1: infrastructure probes it, not clients, so it must
never move when the API version does. So does `/uploads`, which is storage
standing in for R2 rather than API surface, and `/api/docs`, which documents
every version rather than belonging to one.

── Reconstruction note ───────────────────────────────────────────────────
Health is mounted as of F006, auth and the two guarded chains as of
F016/F018, `/uploads` plus the first router under `/v1/dealer` as of F033,
the docs router as of F098, the dealers router as of F040, the public dealer
directory as of F085 and the admin router as of F049.

### `router.use(createMetricsRouter(env.METRICS_SCRAPE_TOKEN!))`

The cross-field env validation guarantees this whenever metrics are on.

### `if (env.DOCS_ENABLED)`

The OpenAPI reference. Outside /v1 for the same reason /health is: it is not

### `if (env.DOCS_ENABLED)`

versioned API surface. Off in production by default (`DOCS_ENABLED`), and

### `if (env.DOCS_ENABLED)`

skipped under test so the suite does not pay to build it 7 times.

### `v1.use(createConfigRouter(container.publicConfig))`

── public ────────────────────────────────────────────────────────────

### `v1.use('/auth', createPublicAuthRouter(container.auth))`

── auth ──────────────────────────────────────────────────────────────

### `v1.use('/auth', createPublicAuthRouter(container.auth))`

Two routers on one prefix, in this order. The first answers the paths that

### `v1.use('/auth', createPublicAuthRouter(container.auth))`

must work without a session — sign-in cannot require being signed in — and

### `v1.use('/auth', createPublicAuthRouter(container.auth))`

falls through for everything else; the second guards what is left. Order is

### `v1.use('/auth', createPublicAuthRouter(container.auth))`

the security boundary here: swapping these two lines would leave

### `v1.use('/auth', createPublicAuthRouter(container.auth))`

`/onboarding` open.

### `const dealer = Router()`

── dealer ────────────────────────────────────────────────────────────

### `const admin = Router()`

── admin ─────────────────────────────────────────────────────────────

## `apps/api/src/server.ts`

### `export function createApp(container: Container): Express`

Express app assembly, and nothing else. No routes are defined here, no
business logic, no listening — that is index.ts's job, which keeps the app
importable from tests without opening a port.

The middleware order IS the security model. Do not reorder casually:

1. request-context — first, so everything below has a traceId, including
   errors thrown by the body parser
2. request-metrics — counts every response, including parser/security errors
3. helmet / cors — reject before doing any work
4. body parsers — bounded, so a huge body cannot exhaust memory
   - cookie parser — before routes, so the session resolver can read it
5. request-logger — after context, so its lines carry the traceId
6. routes
7. not-found — anything unmatched becomes a NotFoundError
8. error-handler — last, always

### `app.set('trust proxy', 1)`

Behind Render/Cloudflare: trust exactly one proxy hop so req.ip is the

### `app.set('trust proxy', 1)`

real client, not the load balancer.

### `app.use(cookieParser())`

Unsigned: the session cookie's value is a random token verified against the

### `app.use(cookieParser())`

database, and the OAuth cookie carries its own HMAC. Neither needs express

### `app.use(cookieParser())`

to sign anything, and a signing secret here would imply a guarantee the

### `app.use(cookieParser())`

session design does not rely on.

## `apps/api/src/worker.ts`

### `if (!env.JOBS_ENABLED)`

The background process (**R40**). No port, no routes, no HTTP.

── Why it is a second process and not a second promise ─────────────────────
The API could send its own emails. `void mailer.send(…)` after the response
would even look asynchronous. It is not: the work still runs on the API's
event loop, still holds its memory, still competes with the next request, and
still dies with a SIGTERM halfway through — with nowhere to record that it
did. When Resend has a slow minute, every one of those becomes the API's slow
minute.

Splitting them gives all four away at once. The API writes one outbox row
inside the transaction that caused it and answers; this process turns the row
into a job, the job into a message, and a failure into a retry. A deploy that
restarts either one loses nothing, because the durable state is a table.

── Same image, same container, different entrypoint ────────────────────────
`node dist/worker.js` rather than `node dist/index.js`. It builds the _same_
container — one composition root, one set of adapters, one place a driver is
chosen — and calls `startWorker`, which is the identical function the API
calls under `WORKER_INLINE=true`. Two processes that registered different
handlers would be a bug nobody notices until a dealer is not told something.

── How many of these to run ────────────────────────────────────────────────
One. pg-boss hands each job to one worker, so more would be safe — but the
scheduled jobs are the reason to be careful, and one is enough for the volume
of email a moderation queue produces. Scale the API instead: that is the
whole point of `WORKER_INLINE=false`.

### `function shutdown(signal: string): void`

Graceful shutdown, and what "graceful" costs here.

A worker has no connections to drain and no load balancer to notify, so there
is no equivalent of the API's fail-readiness-then-wait dance. What it has is
**jobs in flight**, and the only thing that matters is finishing them:
`boss.stop({ graceful: true })` stops fetching new work and waits for the
handlers already running.

Killing it mid-job would not lose an email — pg-boss returns an unfinished
job to the queue and a `PENDING` delivery row is retried — but it _would_
mean a message that was already handed to Resend gets a second attempt. The
`dedupeKey` claim and Resend's idempotency key both cover that. Waiting is
still better than relying on them.

`SHUTDOWN_TIMEOUT_MS` bounds the whole thing, because a handler wedged on a
socket that will never answer must not hold a deployment open until ECS's
`stopTimeout` kills it with a less useful exit code.

### `await closeContainer(container)`

`closeContainer` stops the outbox timer, then pg-boss gracefully, then

### `await closeContainer(container)`

the cache and the database pool — in that order, so nothing is asked to

### `await closeContainer(container)`

finish a job after its connection has gone.

### `process.on('unhandledRejection', (reason) =>`

A worker has no request to fail, so an unhandled rejection here is a bug that
would otherwise be invisible: the job that caused it has already been marked
complete or failed by pg-boss, and the process carries on in an unknown
state. Logged loudly, and — unlike the API — not fatal, because one bad job
must not stop every other email on the queue.
