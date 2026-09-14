# api / middleware

Parent: [api](../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/middleware/auth.ts`

### `export function createAuthMiddleware(sessions: SessionResolver)`

The middleware order IS the security model (ARCHITECTURE §5.4).

requireDealer → puts a real dealerId into the request context
requireDealerActive → refuses anything a suspended dealer may not do
requirePermission → checks capability
…then the service re-checks ownership inside the transaction that writes.

Both checks, always. The guard is never the only check, so there is no
TOCTOU gap between "you may" and "this row is yours" (§8.3).

### `const requireDealer: RequestHandler = (req, _res, next) =>`

Resolves the dealer and writes it into the request. Nothing else may.

### `const requireSignedIn: RequestHandler = (req, _res, next) =>`

Signed in, dealership or not. The guard for the three routes that exist
_because_ a dealership does not: `GET /v1/auth/me`, `POST
/v1/auth/onboarding` and `POST /v1/auth/logout`.

### `export const requireDealerActive: RequestHandler = (req, _res, next) =>`

A dealer who is not ACTIVE can still read their own console — they need to
see why — but cannot publish anything (API-SPEC C11 `DEALER_NOT_ACTIVE`).

### `export function dealerPrincipal(req: Request): DealerPrincipal`

Typed read of the resolved principal. Throws if a route forgot its guard —
a programmer error, and one that must never degrade into "no tenant filter".

### `export function signedInPrincipal(req: Request): DealerPrincipal | PendingPrincipal`

The signed-in person, dealership or not. Throws if `requireSignedIn` is missing.

## `apps/api/src/middleware/error-handler.ts`

### `export interface ProblemDetails`

RFC 9457 Problem Details — the one and only error shape this API emits.

{
"type": "https://dealersdrive.com/errors/not-found",
"title": "Not found",
"status": 404,
"code": "NOT_FOUND",
"traceId": "a1b2c3d4",
"detail": "The requested resource does not exist."
}

### `[key: string]: unknown`

Spec-mandated extras such as `creditBalance` on INSUFFICIENT_CREDITS.

### `function fieldErrorsFromZod(error: ZodError): FieldError[]`

Zod's `invalid_type` becomes `INVALID_TYPE` — machine-readable per field.

### `if (issue.code === 'unrecognized_keys')`

An unrecognized key carries its own name in `keys`, not in `path` — the
path points at the _object_ that had the surplus field. Naming the object
would defeat the point of `.strict()`: the reason an unknown parameter is
a 400 rather than a silent ignore is so the caller can find their typo
(ARCHITECTURE §9.2). One error per stray key, each naming the key.

### `interface BodyParserError extends Error`

Errors thrown by express.json()/urlencoded() before any route runs. They are
client mistakes, not bugs, so they must not fall through to a 500.

### `if (error instanceof ZodError)`

ZodError -> 400 VALIDATION_FAILED, with per-field errors.

### `if (error instanceof AppError)`

NotFoundError -> 404, ForbiddenError -> 403, UnauthorizedError -> 401,

### `if (error instanceof AppError)`

DomainError -> 422 with its own code. Each error carries its own mapping.

### `return build`

Anything else is a bug. Never leak its message in production.

### `export function errorHandler`

The last middleware in the chain. Express 5 forwards rejected promises here
automatically, so `async` handlers need no try/catch wrapper.

### `if (res.headersSent)`

Streaming already started — the only correct move is to destroy the socket.

### `logger.error({ ...logBindings, err: error }, 'request failed')`

TODO(Day 2): Sentry.captureException(error, { tags: { traceId } });

## `apps/api/src/middleware/not-found.ts`

### `export const notFound: RequestHandler = (req, _res, next) =>`

Mounted after every router and before the error handler, so an unmatched
route produces a Problem Details body instead of Express's HTML page.

## `apps/api/src/middleware/rate-limit.ts`

### `export interface RateLimitOptions`

Fixed-window counters over a `CachePort` (§18).

These are a spend control as much as a security control: a phone reveal is
the thing competitors want, and every SMS costs real money (§9.2). That is
why the counter had to stop living in process memory — behind N tasks a
`Map` permits N times the limit written next to it, and reports nothing.

The port is passed in rather than imported. The limiter is built once in the
container, exactly like the auth guards, and handed to the routers that use
it — so a test can hand it a memory cache without touching a global (§5.3).

### `limit: number`

Requests allowed per window.

### `keyBy?: (req: Request) => string`

What to count by. Defaults to the client IP.

### `export type RateLimiter = (name: string, options: RateLimitOptions) => RequestHandler`

What `container.rateLimit` is. Mirrors `container.guards`.

### `export async function consumeRateLimit`

Consume one slot. Async because a shared counter is a network round trip —
shaping this synchronously is what tied the whole design to one process.

### `export function peekRateLimit(cache: CachePort, key: string): Promise<number>`

Reads the current count without consuming — used to decide "captcha after 3".

### `export function createRateLimiter(cache: CachePort): RateLimiter`

Builds the middleware factory. One per process, constructed in the container.

A cache failure does **not** deny the request. A limiter that cannot count is
a limiter with no opinion, and turning a database blip into a site-wide 429
converts a degraded dependency into an outage. The failure is logged by the
error path that surfaces it; the request proceeds.

## `apps/api/src/middleware/request-context.ts`

### `export interface RequestContext`

Everything that is true of "the request currently being handled", available
anywhere in the call stack without threading a parameter through every
function signature.

import { getContext } from '../middleware/request-context.js';
const ctx = getContext();

### `traceId: string`

The id this request is known by, everywhere. Appears in every log line and
every error body.

Adopted from the edge when the edge sent one (see `CORRELATION_HEADERS`),
generated as `nanoid(10)` when it did not. Adopting matters as soon as
anything sits in front of the API: the ALB, the CDN and the web app's BFF
all log an id for the same request, and a trace that cannot be joined
across those three is a trace that only answers questions about one hop.

### `traceInherited?: boolean`

True when `traceId` came from the caller rather than from this process.
Optional because jobs and tests build a context directly and have no
caller to inherit from.

### `dbDurationSeconds?: number`

Cumulative Prisma time for request-vs-database bottleneck analysis.

### `dbOperationCount?: number`

Number of Prisma operations performed while handling this request.

### `export const TRACE_ID_HEADER = 'x-trace-id'`

Response header that lets a dealer's support ticket quote a traceId.

### `export const REQUEST_ID_HEADER = 'x-request-id'`

Echoed alongside `x-trace-id` because it is the name everything else already
uses — nginx, the ALB, and most log shippers look for this one.

### `export const CORRELATION_HEADERS = [`

Inbound headers that may carry an id, in precedence order.

`x-amzn-trace-id` is last on purpose: the ALB sets it on every request, so
taking it first would mean an id supplied deliberately by the web app's BFF
were always ignored.

### `const MAX_TRACE_ID_LENGTH = 64`

Longest inbound id accepted. `x-amzn-trace-id` is ~55 characters.

### `export function sanitizeTraceId(raw: string | undefined): string | undefined`

A caller-supplied id is untrusted input that ends up in every log line for
the request, so it is filtered rather than trusted.

Only unreserved URL characters survive. That rules out the newline that
would let a caller forge a second log entry, the quote that would break the
JSON a log shipper parses, and the control characters that make a terminal
do something other than print. Anything left over that is empty or too long
is discarded and we generate our own.

### `export function inboundTraceId(headers: IncomingHttpHeaders | undefined): string | undefined`

The first usable id among the correlation headers, if any.

Reads the raw header bag rather than `req.get()`: this has to work for a
plain Node request too, and a repeated header arrives as an array, whose
first value is the one the edge set.

### `export function getContext(): RequestContext | undefined`

The current request's context, or undefined when called outside a request
(boot, shutdown, background jobs, workers).

### `export function requireContext(): RequestContext`

Same, for code that cannot meaningfully continue without a request.

### `export function getTraceId(): string | undefined`

Convenience for log lines and error bodies.

### `export function setContextValue<K extends keyof RequestContext>`

Mutates the _current_ context. This is how auth (Day 8) and tenant
resolution (Day 10) attach identity without re-running the middleware
chain — and why every later log line carries userId/dealerId for free.

### `export function runWithContext<T>(context: RequestContext, fn: () => T): T`

Runs a function inside a context. Used by jobs and tests, not by Express.

### `export const requestContext: RequestHandler = (req, res, next) =>`

Must be mounted before anything that logs or throws — everything downstream
runs inside storage.run(), including async continuations.

## `apps/api/src/middleware/request-logger.ts`

### `const QUIET_PATHS = ['/health/live', '/health/ready']`

Health probes fire every few seconds; they log at debug so dev output stays readable.

### `export const requestLogger: RequestHandler = (req, res, next) =>`

One line per completed request. traceId is attached by the logger mixin, so
this line and every line the handler emitted share the same id.

### `const path = req.path`

Captured now: Express rewrites req.url while routing into a mounted

### `const path = req.path`

router, and 'finish' can fire before it is restored.

## `apps/api/src/middleware/request-metrics.ts`

### `const EXCLUDED_PATHS = new Set(['/internal/metrics'])`

The scrape itself must not recursively alter the metrics it is reading.

## `apps/api/src/middleware/validate.ts`

### `export type ValidationSource = 'body' | 'query' | 'params'`

Where a validated value came from. Also the key it is stored under.

### `function withSource(issues: ZodIssue[], source: ValidationSource): ZodIssue[]`

Prefix each issue path with its source, so `errors[].field` reads `body.price`.

### `export function validate<Body = unknown, Query = unknown, Params = unknown>`

Parses the parts of a request a route declares, and nothing else.

r.post('/dealer/vehicles',
validate({ body: CreateVehicleInput }),
c.create);

On failure it forwards a single ZodError carrying every issue from every
source, which the error handler renders as one 400 VALIDATION_FAILED with a
populated `errors[]` — the caller sees all their mistakes at once.

Express 5 makes `req.query` a getter, so parsed values are written to
`req.valid` rather than back onto the request. Read them with
`validated<T>(req, 'query')`; unparsed `req.query` is never the source of
truth in a handler.

Day 5 extends this with `.strict()` contracts so unknown query params 400
instead of being silently ignored (ARCHITECTURE §10.3).

### `export function validated<T>(req: Request, source: ValidationSource): T`

Typed read of a value `validate()` already parsed. Throws if the route
forgot to declare the schema — a programmer error, not a client error.
