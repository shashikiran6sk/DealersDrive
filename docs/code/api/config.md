# api / config

Parent: [api](../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/config/env.ts`

### `dotenv.config(`

Loads .env from the app directory first, then the repo root. dotenv never
overwrites a variable that is already set, so real environment variables
(Render, GitHub Actions, docker run -e) always win over files.

### `const required = (localDefault: string) =>`

A required string that falls back to a local-dev value outside production.
In production the fallback is dropped, so a missing variable fails at boot
instead of silently pointing the live API at localhost.

### `const optional = <T extends z.ZodTypeAny>(schema: T) =>`

An optional variable that may be present but blank.

`.env.example` lists every production credential with an empty value, so a
developer can see what exists without hunting through documentation. dotenv
reads `GOOGLE_CLIENT_ID=` as the empty string, not as absent — and `""` is a
value, so a plain `.optional()` would fail `.min(1)` on a variable nobody
set. Blank means unset, everywhere.

### `GIT_SHA: z.string().min(1).default('unknown')`

The commit this artifact was built from, injected as a Docker build
argument and surfaced by `/health/ready`.

It is the answer to "what is actually running right now", and the
production promotion refuses to run until the SHA it was asked for is the
SHA dev reports (§20.3). `unknown` is the honest local value: a `pnpm dev`
process was not built from anything.

### `METRICS_ENABLED: z`

Prometheus/OpenMetrics exposition for Grafana Cloud's managed Metrics
Endpoint scraper. The endpoint is bearer-authenticated and deliberately
outside the public API namespace.

### `DB_SLOW_OPERATION_MS: z.coerce.number().int().positive().default(500)`

A query at or above this duration is counted and logged as slow.

### `GRAFANA_CLOUD_LOGS_ENABLED: z`

Optional direct Loki transport. It runs in Pino's worker thread, batches
writes, keeps stdout as a fallback, and is enabled explicitly per runtime.

### `WEB_ORIGIN: required('http://localhost:3000')`

Comma-separated browser origins allowed to call this API with credentials.

### `WEB_BASE_URL: required('http://localhost:3000')`

Absolute base of the public site — used for canonical URLs and SEO.

### `API_BASE_URL: required('http://localhost:4000')`

Absolute base of this API — used to build presign and media URLs.

### `DB_TRANSACTION_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000)`

The wall-clock budget for one interactive transaction, and how long a
transaction may wait for a connection before it starts.

Prisma's defaults are 5s and 2s, which assume the database is a network
hop away. Against a managed Postgres in another region a round-trip costs
~500ms, and a settlement — `settleCapturedPayment` is the longest at eight
sequential statements — takes ~7s. Under the default it dies with P2028
partway through and rolls back, which loses a credit purchase _silently_:
the order stays PENDING, no ledger row is written, and the dealer's cached
balance is the only thing that ever suggested the credits existed.

Raising the budget is the fix for the environment, not a licence to add
statements — every one of them is still a round-trip inside a row lock.

### `AUTH_MODE: z.enum(['cookie', 'dev']).default('cookie')`

Which `SessionResolver` the container builds.

cookie — the real thing: `dd_session` → `sessions` row → principal
dev — the server-configured identity below, for a developer who has
no Google credentials yet. Refused in production, and it logs a
warning on every boot so it can never be mistaken for the norm.

### `DEV_DEALER_SLUG: z`

Local development identity (CLAUDE.md §5, §17), used only when
`AUTH_MODE=dev`. Production auth replaces the resolver, not these values —
nothing downstream of `resolvePrincipal` knows the difference, and no route
ever reads an identity from a client.

### `.default('sri-lakshmi-automobiles-pvt-ltd-vellore-tamil-nadu')`

The dealership `prisma/seed/data.ts` writes. Its slug is derived there

### `.default('sri-lakshmi-automobiles-pvt-ltd-vellore-tamil-nadu')`

rather than typed, so this literal is the copy — and

### `.default('sri-lakshmi-automobiles-pvt-ltd-vellore-tamil-nadu')`

`tests/unit/config/env.test.ts` fails if the two ever disagree.

### `ADMIN_ALLOWLIST: z.string().default('shashikiran6.sk@gmail.com')`

Who may hold an admin session, by verified Google address.

This was the **entire** admin authorization model until **R42**, and it is
still the first half: a list of addresses in the environment rather than a
flag on a row. Two consequences worth being explicit about:

- An address here cannot be added or removed from the console. That is the
  cost, and it buys the property that no bug in an admin screen — no mass
  update, no seed run against the wrong database, no unguarded
  `isPlatformAdmin` write — can promote anybody on this list, because the
  list is not in the database.
- Removing an address takes effect on the next request. The allow-list is
  checked when the session is issued _and_ when it is resolved, so
  deleting a name here revokes a console that is already open.

**The second half, since R42.** A SUPER_ADMIN can grant admin access from
the settings screen, which writes a `user_roles` row with `grantedBy` set.
`grantedBy` is the whole distinction: every admin sign-in leaves an ADMIN
seat behind, so a seat's _existence_ means only "has signed in once" —
reading that as permission would make this list vacuous. A grant is
withdrawn the same way it was made, and it never touches this variable.

Comma-separated, compared case-insensitively. Empty means no one may sign
in to the admin console at all, which is the right failure: a
misconfiguration should close the door, not open it.

The **first** entry is also the account the seed creates and the identity
`AUTH_MODE=dev` resolves to — there is one answer to "who is the admin
here", and it is this variable. A separate `DEV_ADMIN_EMAIL` used to exist
and could disagree with this list, which meant a local database seeded with
an admin nobody was allowed to sign in as.

### `GOOGLE_CLIENT_ID: optional(z.string().min(1))`

Dealer sign-in — Google OAuth 2.0 / OpenID Connect (authorization code +
PKCE + nonce). No default: a fabricated client id would turn a
configuration mistake into a broken redirect at Google rather than a clear
error at boot. `assertGoogleConfigured()` is what routes call.

### `SESSION_SECRET: z.string().min(16).default('dealers-drive-local-session-secret')`

Signs the short-lived OAuth transaction cookie (state · nonce · PKCE
verifier) and nothing else. Session tokens are random, not signed.

### `SESSION_COOKIE_DOMAIN: optional(z.string().min(1))`

Empty in every environment, and that is the design (docs/DEPLOYMENT.md §F4).

Each environment serves the web app and the API on a single origin, so the
cookie is already shared where it needs to be. A parent-domain cookie
would also be sent to every _other_ environment on that domain — a dev
session presented to production. Host-only is what makes that impossible.

### `PAYMENT_PROVIDER: z.enum(['development', 'razorpay']).default('development')`

`development` settles instantly; `razorpay` is the production adapter.

### `STORAGE_DRIVER: z.enum(['local', 'minio', 'r2']).default('local')`

One `StoragePort`, three ways to terminate a PUT:

local — the filesystem. No container needed; what the test suite uses.
minio — S3-compatible, on localhost:9000. What `docker compose` gives you.
r2 — S3-compatible, at Cloudflare. Production.

`minio` and `r2` are the _same adapter_: only S3_ENDPOINT and the keys
differ, which is the whole claim this seam has to keep true (§12.1).

### `S3_FORCE_PATH_STYLE: z`

MinIO needs path-style addressing (`endpoint/bucket/key`); R2 accepts it
too, so it is on by default and only worth turning off for a bucket served
from a virtual-hosted domain.

### `UPLOAD_SIGNING_SECRET: z.string().min(8).default('dealers-drive-local-upload-secret')`

Signs local presigned upload URLs. Any secret works locally.

### `MAIL_DRIVER: z.enum(['console', 'smtp', 'resend']).default('console')`

Where transactional emails go (**R40**).

console — prints the recipient, the subject and the plain-text body.
The default, what `pnpm dev` and the whole test suite use, and
refused in production.
resend — the real provider, over its HTTP API. Needs RESEND_API_KEY.
smtp — **not implemented.** In the enum because the baseline had it
there, with no adapter behind it then either. The guard below
refuses it at boot rather than letting a deployment discover
at the first approval that nothing sends.

### `SMS_DRIVER: z.enum(['console', 'msg91']).default('console')`

`console` locally, `msg91` in production. Transactional SMS, not the OTP.

### `MSG91_AUTH_KEY: optional(z.string().min(1))`

One key, two uses — transactional SMS (`SMS_DRIVER`) and the OTP widget's
server-side check (`PHONE_OTP_DRIVER`). It is the same MSG91 account, so a
second variable holding the same secret would be a second thing to rotate.

### `PHONE_OTP_DRIVER: z.enum(['fake', 'msg91']).default('fake')`

Who proves a dealer's mobile number (**R39**).

fake — no SMS, no widget script, no network. Accepts the development
token shape described in `platform/phone-otp/fake.adapter.ts`,
whose code is `PHONE_OTP_DEV_CODE`. The default, and what the
test suite uses: onboarding works end to end on it.
msg91 — the real thing. The widget runs in the dealer's browser and
sends the SMS; this process only asks MSG91 whose handset the
resulting token proves.

Refused in production below, exactly as `CACHE_DRIVER=memory` and
`STORAGE_DRIVER=local` are — a development bypass of an ownership check is
not something a deployment should be able to reach by leaving a variable
unset.

### `MSG91_WIDGET_ID: optional(z.string().min(1))`

`widgetId` and `tokenAuth` from the MSG91 widget configuration.

Both reach the browser — the widget cannot initialise without them — but
they are served from `GET /v1/auth/phone/widget` rather than inlined as
`NEXT_PUBLIC_*` (rule 9), so rotating one is a restart rather than a
rebuild of the web image.

### `PHONE_OTP_TIMEOUT_MS: z.coerce.number().int().positive().default(4000)`

How long the server waits for MSG91 to say whose token this is.

Four seconds, matching `RC_LOOKUP_TIMEOUT_MS` and for the same reason: a
dealer is watching a spinner and "try again" is one press away, so failing
fast beats succeeding slowly.

### `PHONE_OTP_DEV_CODE: z`

The six digits the `fake` driver accepts. Never reachable in production.

### `RC_LOOKUP_DRIVER: z.enum(['mock', 'attestr']).default('mock')`

Where registration lookups come from (ARCHITECTURE §6.3).

mock — deterministic and free. The default, and what the test suite
uses. Intake works end to end on it; it is not a stub.
attestr — the real provider. Costs money per call, so this is never the
default and the guard below refuses it without a token.

### `ATTESTR_AUTH_TOKEN: optional(z.string().min(1))`

Basic-auth token. Without it, every lookup 503s and dealers fall back to typing.

### `RC_LOOKUP_TIMEOUT_MS: z.coerce.number().int().positive().default(4000)`

How long a dealer waits before we give up and offer the manual form.

Four seconds, not thirty: this is on the critical path of adding a car and
the fallback is one click away, so failing fast beats succeeding slowly.

### `RC_PLATE_HASH_SECRET: z.string().min(8).default('dealers-drive-local-plate-secret')`

Keys the HMAC that `rc_lookups.regHash` stores instead of the plate.

Not secrecy from ourselves — real listings hold the plate in
`vehicles.regNumberMasked`. It stops the lookup cache becoming a
standalone, queryable register of every plate anyone ever asked about,
including the ones that never became a listing. Rotating it costs one
cache generation and nothing else.

### `SENTRY_DSN: optional(z.string().url())`

Accepted and validated so production configuration is complete, but no SDK
is installed — see README "Remaining production setup". An unset DSN is the
normal local state and must never be an error.

### `WORKER_INLINE: z`

One image, two process types. `WORKER_INLINE=true` runs the handlers in
the HTTP process so `pnpm dev` stays a single command (§19.1).

### `JOBS_ENABLED: z`

Turns pg-boss off entirely — used by the integration suite.

### `CACHE_DRIVER: z.enum(['memory', 'postgres']).default(isProduction ? 'postgres' : 'memory')`

Where shared, cross-instance state lives — rate-limit windows and the
config-cache version (`platform/cache`, §18).

memory — a `Map` in this process. Right for `pnpm dev`, right for the
test suite, right for exactly one running task.
postgres — the database the API already has. The production default,
and no new infrastructure.

`memory` is refused in production below, and that refusal is the point of
this variable existing at all: a process-local counter behind N tasks
permits N times the limit written next to it, and reports nothing.

### `CONFIG_VERSION_POLL_MS: z.coerce.number().int().positive().default(10_000)`

How often a task re-reads the shared config version to decide whether its
in-process `PlatformConfig` cache is stale.

This is the ceiling on "how long until an admin's change is live
everywhere". Ten seconds costs one trivial indexed read per task per ten
seconds; the five-minute cache TTL it short-circuits used to be the only
answer (§30).

### `SHUTDOWN_DRAIN_MS: z.coerce`

Shutdown, in two phases (§20.10).

DRAIN_MS is the pause _before_ the server stops accepting connections:
`/health/ready` starts answering 503 immediately on SIGTERM, and the load
balancer needs a moment to notice and stop sending new requests. Closing
the listener first is what produces the connection resets that look like a
deploy causing errors. It should exceed the target group's health-check
interval x unhealthy-threshold.

TIMEOUT_MS is the total budget after that, after which the process exits
anyway rather than hanging a deployment.

### `DOCS_ENABLED: z`

Serves the OpenAPI reference at `/api/docs`.

On outside production, off inside it: the document lists every endpoint,
every permission and every error code, which is a useful map for a
developer and an equally useful one for anybody probing the live API.
Turning it on in production is a deliberate `DOCS_ENABLED=true`, not a
default. Also off under test — building it 7 times to serve it 0 is waste.

### `const LOCAL_SESSION_SECRET = 'dealers-drive-local-session-secret'`

The local defaults that are fine on a laptop and must never reach production.

### `const checkedEnvSchema = envSchema.superRefine((value, ctx) =>`

Cross-field rules — "this variable is required _because_ of that one".

They exist so a production deployment fails at boot rather than at the first
dealer who tries to sign in. Nothing here silently falls back to a local
provider: choosing R2 without keys is a configuration error, not a reason to
start writing to the container's filesystem.

### `if (production && value.MAIL_DRIVER === 'console')`

R40. `console` prints and sends nothing, which in production means a dealer
is verified and never told — and the failure is silent, because the log
line says the email was "sent". Loud at boot is the only acceptable place
for that to be discovered.

### `if (value.PHONE_OTP_DRIVER === 'msg91')`

Checked outside production too, like the Attestr token below and for the
same reason: a preview environment pointed at the MSG91 widget with no
credentials would refuse every verification silently, and nobody would
know until a dealer could not finish signing up.

### `if (value.RC_LOOKUP_DRIVER === 'attestr' && !value.ATTESTR_AUTH_TOKEN)`

Checked outside production too: pointing a preview environment at Attestr

### `if (value.RC_LOOKUP_DRIVER === 'attestr' && !value.ATTESTR_AUTH_TOKEN)`

with no token would spend nothing and fail every lookup silently, which is

### `if (value.RC_LOOKUP_DRIVER === 'attestr' && !value.ATTESTR_AUTH_TOKEN)`

a worse outcome than refusing to boot.

### `readonly adminAllowlist: string[]`

`ADMIN_ALLOWLIST`, split and lower-cased. Half the admin authorization model — see R42 for the other.

### `console.error(`\nInvalid environment configuration:\n${details}\n`)`

The logger depends on env, so this one message cannot go through pino.

### `adminAllowlist: value.ADMIN_ALLOWLIST.split(',')`

`ADMIN_ALLOWLIST`, split and lower-cased once so every comparison matches.

### `export const env: Env = loadEnv()`

Validated, frozen, import-anywhere. Reading process.env elsewhere is a bug.

### `export function googleCredentials():`

Google OAuth credentials, or a developer-facing explanation of what to set.

Called by the two routes that need them rather than at boot, so a developer
who has not registered an OAuth client yet still gets a working API, a
working marketplace and a working admin console — and a precise error the
moment they press "Continue with Google". Production never reaches the throw:
`checkedEnvSchema` has already refused to start (§29).
