# api / platform/telemetry

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/platform/telemetry/http-route.ts`

### `export function normalizedHttpRoute(req: Request): string`

Turns Express's route-local pattern and the original path into one stable,
full route template. Values such as dealer slugs and UUIDs must never become
metric labels or Loki stream labels.

Express leaves `req.route.path` behind after a route matches, but restores
`req.baseUrl` while unwinding nested routers. Counting path segments lets us
recover the mount prefix without depending on Express internals.

## `apps/api/src/platform/telemetry/lifecycle.ts`

### `let draining = false`

Where the process is in its own life, readable from a request handler.

It exists for one narrow reason: **a task that is shutting down must fail its
readiness check before it stops accepting connections** (§20.10).

The order matters and is easy to get backwards. If SIGTERM closes the
listener first, every request the load balancer had already routed — and
every one it routes in the seconds before its next health check — is met with
a connection reset. Those show up as 502s during a deploy and look like the
new version is broken. Answering 503 on `/health/ready` first tells the
target group to take this task out of rotation while it is still perfectly
able to finish the work it already has.

`/health/live` is deliberately unaffected: the process _is_ alive, and a
liveness probe that fails during a graceful drain gets the container killed
mid-drain, which is the opposite of what any of this is for.

### `export function isDraining(): boolean`

True once a shutdown signal has been received.

### `export function drainingForMs(): number | undefined`

Milliseconds since the drain began, or undefined if not draining.

### `export function beginDraining(): void`

Idempotent — a second SIGTERM must not restart the clock.

### `export function resetLifecycle(): void`

Test-suite affordance. Never called by application code.

## `apps/api/src/platform/telemetry/logger.ts`

### `export const LOGGER_OPTIONS: LoggerOptions =`

Structured JSON logs, one line per event.

The mixin is the important part: every log line emitted anywhere inside a
request — controller, service, repository, error handler — automatically
carries that request's traceId. Principal IDs deliberately stay out of the
centralized stream; audit records, not application logs, hold actor identity.

The options are exported because pino fixes its destination at construction:
there is no way to ask the live `logger` what it would have written. A test
builds a second logger from _these_ options and a capturing stream, so what it
asserts on is the real redaction list and the real mixin rather than a copy of
them that can drift.

### `timestamp: pino.stdTimeFunctions.epochTime`

Epoch milliseconds are understood by CloudWatch and are the native input

### `timestamp: pino.stdTimeFunctions.epochTime`

pino-loki converts to Loki nanoseconds. Keeping an ISO string here would

### `timestamp: pino.stdTimeFunctions.epochTime`

make the Loki transport unable to build a valid timestamp.

### `err(value: unknown)`

Provider/HTTP client errors sometimes embed request URLs or response
bodies in `message`. Those can contain OAuth codes or credentials, so a
centralized log gets the useful type, bounded code and call frames but
never the uncontrolled message text.

### `const endpoint = new URL(env.GRAFANA_CLOUD_LOKI_URL!)`

Cross-field validation guarantees all three values when the transport is enabled.

### `{ target: 'pino/file', options: { destination: 1 } }`

Keep the platform-native stdout copy as a fallback and for ECS diagnostics.

### `propsToLabels: ['method', 'route', 'status_code']`

These values are bounded. traceId stays in the JSON body and never

### `propsToLabels: ['method', 'route', 'status_code']`

becomes a high-cardinality Loki stream label; principal IDs are

### `propsToLabels: ['method', 'route', 'status_code']`

censored before either destination receives the record.

### `levelMap:`

LOGGER_OPTIONS intentionally renders levels as readable strings;

### `levelMap:`

pino-loki's defaults expect Pino's numeric levels.

### `export function childLogger(component: string): Logger`

Child logger for a subsystem: `const log = childLogger('jobs')`.

## `apps/api/src/platform/telemetry/metrics.docs.ts`

### `export const metricsDocs: ModuleDocs =`

Mounted only when `METRICS_ENABLED` (the cross-field env validation
guarantees `METRICS_SCRAPE_TOKEN` whenever it is), so this operation exists
in the reference regardless of the environment that generated it — the
document describes the API surface, not one deployment's flags.

## `apps/api/src/platform/telemetry/metrics.ts`

### `buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20]`

Covers cache hits through deliberately slow provider/database failures.

### `exemplarLabels: exemplarLabels as never`

The upstream declaration incorrectly constrains exemplar keys to metric

### `exemplarLabels: exemplarLabels as never`

label keys; OpenMetrics permits an independent trace_id label set.

### `export function resetApplicationMetrics(): void`

Test-only reset seam. Production counters are never reset.
