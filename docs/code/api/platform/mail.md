# api / platform/mail

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/platform/mail/console.adapter.ts`

### `export function createConsoleMailer(): MailerPort`

Prints what would have been sent (**R40**).

The default, and what `pnpm dev` and the whole test suite run on. It is not a
no-op: it logs the recipient, the subject and the **plain-text body**, which
is the part a developer actually needs to check — a template that renders
`undefined` into a sentence is invisible in HTML and obvious here.

Everything above it is unchanged. The same worker, the same idempotency
claim, the same `SENT` row. Only the network call is replaced, which is what
makes "does the approval email fire" answerable without a Resend account.

### `\n──── email (not sent) ────\n${message.text}\n──────────────────────────`

The body on its own line, so it is readable in a terminal rather than

### `\n──── email (not sent) ────\n${message.text}\n──────────────────────────`

folded into a JSON field.

## `apps/api/src/platform/mail/deliverability.ts`

### `export function mailDeliverabilityIssues`

Safe, configuration-only checks that can run at process startup.

They deliberately do not make a network request or claim to measure inbox
placement. Their job is to catch the two concrete mistakes visible in the
incident email before another real message is sent with them.

## `apps/api/src/platform/mail/factory.ts`

### `export function createMailer(): MailerPort`

The `MAIL_DRIVER` seam, resolved once in the container (**R40**).

`env.ts` refuses `resend` without an API key and refuses `console` in
production, so neither branch can be reached in a state it cannot serve — the
failure is a refused boot naming a variable, rather than a dealer never
hearing that their application was approved.

`smtp` is in the enum and is **not implemented**; `env.ts` refuses it at boot
and says so. It was in the baseline's enum too and had no adapter there
either. Wiring Mailpit would mean an SMTP client, which means a dependency,
for a local convenience the console driver already covers — and the console
driver prints the plain-text body, which is more useful for checking a
template than a rendered message in a web inbox.

## `apps/api/src/platform/mail/mail.port.ts`

### `export interface MailMessage`

Email behind one narrow port (**R40**).

The port is deliberately thin: an address, a subject, two bodies and a tag.
No attachments, no CC, no templates, no scheduling — none of which any of the
transactional messages need, and every one of which would be a shape a second provider
has to be bent into later.

── Where this is called from, and where it is not ──────────────────────────
**Only the worker.** No route, no service and no request handler holds a
`MailerPort`. The API's contribution to an email is one outbox row written
inside the transaction that caused it; everything after that happens in
another process. That is the whole architecture of this revision, and it is
why this file lives under `platform/` rather than in a module.

### `html: string`

The message. Both bodies are always sent — see the note in `templates.ts`.

### `tag: string`

The template name, for the provider's own dashboard.

Resend groups by tag, which turns "are approval emails bouncing" into a
filter rather than a support ticket. Never a dealer id: a tag is low
cardinality by design and the provider is not a place to put identifiers.

### `idempotencyKey: string`

Passed to the provider as an idempotency key where it supports one.

Belt and braces. `notification_deliveries.dedupeKey` is the guarantee that
matters, because it is ours and it is a unique index; this is the second
line, for the window between claiming a row and the provider answering.

### `providerMessageId: string | null`

The provider's own id, when it gives one. Stored for support questions.

### `readonly driver: 'console' | 'resend'`

For the boot log and the health payload.

### `send(message: MailMessage): Promise<MailResult>`

Throws on any failure. The caller — and there is exactly one — turns that
into a retry, and eventually into a `FAILED` row somebody can read.

## `apps/api/src/platform/mail/resend.adapter.ts`

### `const ENDPOINT = 'https://api.resend.com/emails'`

Resend, over its HTTP API and with no SDK (**R40**).

Same reasoning as `platform/notify/msg91.adapter.ts` in the baseline and as
the Firebase verifier: the job is one authenticated `POST` with a JSON body,
and a dependency to do that is a dependency to audit, update and explain. The
whole adapter is forty lines and every one of them is readable.

Selected by `MAIL_DRIVER=resend`; `env.ts` refuses to start without the API
key when it is. Nothing above `MailerPort` changes: the same worker that
printed to a console locally posts here.

── The two error shapes, and why they are different ────────────────────────
A **5xx or a network failure** is Resend having a bad day. It is retryable,
and the worker's backoff exists precisely for it.

A **4xx** is us: an unverified sending domain, a malformed address, a revoked
key. Retrying that five times with backoff wastes twenty minutes and then
produces the same failure, so it is marked permanent and the delivery row
carries the provider's own sentence — which is usually the exact instruction
needed ("The domain is not verified").

### `function resendTagValue(value: string): string`

Resend tag names and values only accept this provider-specific alphabet.

### `export class PermanentMailError extends Error`

Marks a failure the worker must not retry. See the note above.

### `Authorization: `Bearer ${env.RESEND_API_KEY ?? ''}``

The key is a header, never a query parameter: URLs end up in

### `Authorization: `Bearer ${env.RESEND_API_KEY ?? ''}``

access logs and this one is a credential.

### `'Idempotency-Key': message.idempotencyKey`

Resend deduplicates on this for 24 hours. It is the second line
of defence, not the first — `notification_deliveries.dedupeKey`
is a unique index and is ours — and it covers the one window
that index cannot: a row claimed, a request sent, and the
response lost on the way back.

### `throw new UpstreamUnavailableError('Resend could not be reached.'`

DNS, TLS, a dropped socket. Always retryable.

### `const detail = (await response.text().catch(() => '')).slice(0, 500)`

The provider's sentence, bounded. Never the body we sent.
