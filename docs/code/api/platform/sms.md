# api / platform/sms

Parent: [api](../../README.md)

The notes below belong to the files named under each heading. Each heading is the
declaration the note is about.

## `apps/api/src/platform/sms/sms.port.ts`

### `export interface SmsPort`

The transactional SMS seam (**R118**), the counterpart of the mailer port and
resolved once in the container by `SMS_DRIVER`. It is not the OTP widget:
`platform/phone-otp` _verifies_ a number the browser widget has texted, and this
port _sends_ a message the platform decided to send. They share one MSG91
account and its `MSG91_AUTH_KEY`, and nothing else.

`templateId` and `variables` rather than a body, because a transactional SMS to
an Indian number must match a DLT-registered template word for word. The text
is owned by the template in the MSG91 account; the code supplies only the
variables, and therefore cannot send a sentence nobody registered.

### `export class PermanentSmsError`

The same split as `PermanentMailError`. A refusal (a bad key, an unapproved or
mistyped template, a malformed number) will fail identically every time, so the
worker marks the delivery FAILED and stops. An outage (5xx, 429, a timeout, an
unreachable host) is an `UpstreamUnavailableError`, and pg-boss retries it with
backoff.

## `apps/api/src/platform/sms/msg91.adapter.ts`

### `export function createMsg91Sms`

One POST to the Flow API (`/api/v5/flow`):

- The key goes in the `authkey` header, never in a URL or a log.
- The number is sent as bare digits (`919840012345`), which is the form MSG91
  expects.
- `short_url` is off: the acknowledgement carries no link, so there is nothing
  to shorten, and a shortened link in a support SMS reads as phishing.

A 200 whose body says `type: error` is treated as a refusal. MSG91 reports some
template problems that way.

The request has a timeout (`SMS_TIMEOUT_MS`). The worker would rather retry
than hold a job for minutes.

## `apps/api/src/platform/sms/console.adapter.ts`

### `export function createConsoleSms`

The default, and what the test suite is pinned to (`vitest.config.ts`). It
logs the **masked** number, the template and the variables, and sends nothing.
Everything above it — the outbox, the job, the idempotency claim, the SENT row —
is the production path. Production refuses it: a deployment that looked
configured and texted nobody would fail silently.

## `apps/api/src/platform/sms/disabled.adapter.ts`

### `export function createDisabledSms`

The explicit opt-out for a deployment whose acknowledgement template is not yet
DLT-approved. The notification service sees `driver === 'disabled'` and skips
before claiming a delivery row, so the log does not fill with SENT rows for
messages nobody received.

## `apps/api/src/platform/sms/mask.ts`

### `export function maskPhone`

Every log line that mentions a number uses this, showing the last four digits
only. The full number is stored in exactly one place, the delivery row's
`recipient`, which is behind `admin:notifications:read` (Super admin), as
email addresses already are.
