# api / platform

Parent: [api](../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/platform/errors.ts`

### `export const PROBLEM_TYPE_BASE = 'https://dealers-drive.com/errors'`

The error vocabulary of the whole API.

Services throw these; the error handler is the only thing that turns them
into HTTP. A service that builds a response, sets a status code, or touches
`res` is doing the error handler's job.

### `export const PROBLEM_TYPE_BASE = 'https://dealers-drive.com/errors'`

Base for the RFC 9457 `type` URI. Each code gets a stable, documentable URL.

### `export interface FieldError`

One invalid field. Mirrors the `errors[]` array in API-SPEC §0.2.

### `extra?: Record<string, unknown>`

Extra top-level keys the spec puts in a specific problem body.

### `abstract readonly code: string`

The machine-readable contract. The frontend switches on this, never on `detail`.

### `abstract readonly title: string`

Short, human, stable across occurrences of the same code.

### `get detail(): string`

RFC 9457 calls it `detail`; Error calls it `message`. Same string.

### `export class NotFoundError extends AppError`

404 — the resource does not exist, or the caller may not know that it does.
Cross-tenant access answers 404, never 403, so existence is not leaked (§7).

### `export class UnauthorizedError extends AppError`

401 — no valid session.

### `export class ForbiddenError extends AppError`

403 — authenticated, but not allowed.

### `export class ConflictError extends AppError`

409 — the request collides with the current state. Two moderators opening
the same card is expected; the second one gets a clear error rather than a
double approval.

### `export class DomainError extends AppError`

422 — the request was well-formed and the caller was allowed, but a business
rule said no. The code travels with the error:

throw new DomainError('INSUFFICIENT_CREDITS', 'Publishing needs 1 credit; your balance is 0.');

### `export class ConfigurationError extends AppError`

503 — the API is configured such that it cannot perform this operation.

Not the caller's fault and not a business rule: a credential is missing. The
detail is written for the developer who has to fix it and names the variable,
because the alternative — a generic 500 — sends them to the logs to learn
something the response could have told them (§29).

### `export class UpstreamUnavailableError extends AppError`

503 — a dependency we do not control is not answering.

Distinct from `ConfigurationError`, which is also 503: that one means _we_
are set up wrong and a developer must fix it. This one means someone else's
service is down and the right response is to try later or take another path.
Conflating them sends an operator hunting for a missing credential during a
vendor outage.

### `export class RateLimitError extends AppError`

429 — over a limit. Always accompanied by `Retry-After`.

### `export function problemTypeFromCode(code: string): string`

`NOT_FOUND` -> `https://dealers-drive.com/errors/not-found`

### `export function titleFromCode(code: string): string`

`INSUFFICIENT_CREDITS` -> `Insufficient credits`

### `export function isRecord(value: unknown): value is Record<string, unknown>`

Reading a property off a value that is `unknown` by construction — a caught
error, a library's rejection.

Duck-typed rather than `instanceof`, deliberately: the Prisma client's error
classes are not stable across versions, an AWS SDK rejection is a plain object
with `$metadata` on it, and a test throwing `{ code: 'P2002' }` should take the
same path as the real thing. A type guard rather than an assertion, so the
check that narrows is the check that runs.

### `export function errorString(error: unknown, key: string): string | undefined`

A string property of a caught error, or undefined.

### `export function errorNumber(error: unknown, key: string): number | undefined`

A numeric property of a caught error, or undefined.

### `export function errorCode(error: unknown): string | undefined`

The provider's error code — Prisma's `P2002`, an SDK's `NoSuchKey`.

### `export function awsStatusCode(error: unknown): number | undefined`

The HTTP status an AWS SDK rejection carries on `$metadata`.

## `apps/api/src/platform/messages.ts`

### `export const ALREADY_REGISTERED = 'Already registered.'`

The sentences more than one module says.

A message a person reads is part of the product's voice, and two modules
writing it out separately is how "That upload does not exist." becomes "That
upload doesn't exist." on one screen and not the other. Messages that only one
module ever says stay in that module.

### `export const ALREADY_REGISTERED = 'Already registered.'`

A field refusal: the value is taken, whichever uniqueness rule caught it.

### `export const MALFORMED_REQUEST = 'The request did not match the expected shape.'`

What a failed `validate()` says before the per-field errors underneath it.

## `apps/api/src/platform/pagination.ts`

### `export function encodeCursor(date: Date): string`

Opaque cursors, shared by every paginated list.

They started life inside the enquiries module and were imported from three
others, which is exactly the coupling ARCHITECTURE §5.5 rule 3 forbids. They
are not enquiry logic — they are the encoding of "where the last page ended" —
so they belong to the platform.

The cursor is base64url so it reads as opaque to a client. It is not a secret:
anyone can decode it, and there is nothing in it worth hiding. What matters is
that a client cannot _construct_ one that means something else — hence the
validation on the way back in.

### `export function encodeSeqCursor(seq: bigint): string`

The ledger paginates on its append sequence, not on a timestamp.
