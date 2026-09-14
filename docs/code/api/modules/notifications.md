# api / modules/notifications

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/notifications/notifications.service.ts`

### `export interface NotificationsDeps`

Who gets told what, and when (**R40**).

── The shape of the whole thing ────────────────────────────────────────────

    API request
       ↓  validate, do the business operation
       ↓  enqueueOutbox(tx, …)      ← same transaction as the state change
       ↓  COMMIT
       ↓  respond                    ← the request is over here

    Worker process
       ↓  OutboxPublisher polls unpublished rows
       ↓  bus.publish(event)  →  subscribe() below
       ↓  queue.send('notification.email', { … })
       ↓  handleEmailJob()  →  claim, render, send via Resend

**The API never waits on Resend, and never touches it.** No route, service or
request handler in this codebase holds a `MailerPort`. The API's entire
contribution to an email is one row in `outbox_events`, written inside the
transaction that caused it — which is what makes the email exactly as durable
as the state change and no more.

That the sending is a separate _process_ rather than a `void`-ed promise is
the part that matters under load. A fire-and-forget `send()` in a request
handler still occupies the API's event loop, still holds its memory, still
dies with a SIGTERM mid-flight, and still has nowhere to record that it
failed. Queueing gives all four away: the API's tail latency is unaffected by
a provider having a bad minute, and a deploy that restarts the API loses
nothing.

── Two hops, and why the middle one is not skipped ─────────────────────────
The outbox could enqueue a pg-boss job directly instead of publishing to an
in-process bus. It does not, because pg-boss's `send` is not transactional
with the caller's write — so "the dealership was approved" and "the job
exists" would be two commits, and a crash between them is a dealer who is
verified and never told. The outbox row _is_ the transactional part; the bus
is how it fans out; the queue is what survives a restart mid-send.

── Ids, never PII ──────────────────────────────────────────────────────────
An event payload carries a dealer id. The job payload carries a template name
and ids. The **worker** resolves the name and the address, at send time, out
of the database. An email address copied into a queue row is an address that
goes stale the moment the dealer changes it — and a queue is not a place to
keep personal data waiting.

### `export interface EmailJob extends Record<string, unknown>`

What travels on the queue. Small, and resolvable — never a rendered body.

### `dealerId: string`

The dealership the message is about. Everything else is read from it.

### `audience: 'dealer' | 'admin'`

`dealer` resolves to the owner's address; `admin` fans out to the allow-list.

### `subjectId: string`

What makes two attempts the same email.

Derived from the **event** — its id, or the decision it carries — and never
from the attempt. A key generated per job would be unique per delivery and
would deduplicate nothing, which is the mistake this comment exists to
stop somebody making later.

### `profileChangeId?: string`

The `DealerProfileChange` this message is about, for the two templates that
are about one.

The moderator's email has to show what was **proposed**, not what is live —
reading the dealership row would render the very words the dealer is asking
to replace, which is the opposite of the question being asked. An id rather
than the text itself, for the same reason nothing else on a job payload is
PII: the worker resolves it at send time.

### `async function enqueue(job: EmailJob): Promise<void>`

The events that produce an email, and the templates they produce.

A table rather than a switch, because the interesting property is that it
is **six product rules on six lines** — a reader checking "does a rejection
email the dealer" should not have to read a function to find out.

### `subscribe(bus: EventBus): void`

Wires the notification rules onto the bus. Called once, by the process that runs
the outbox — which is the worker, or the API when `WORKER_INLINE=true`.

### `bus.on('DealerApplied', async (event) =>`

1 — a dealership submits its application: tell the dealer, and us.

### `bus.on('DealerApplied', async (event) =>`

A returned application gets explicit resubmission wording so neither

### `bus.on('DealerApplied', async (event) =>`

audience mistakes it for the first submission arriving again.

### `bus.on('DealerApproved', async (event) =>`

2 — approved.

### `bus.on('DealerRejected', async (event) =>`

3 — rejected, and changes requested. Two events, two templates: they

### `bus.on('DealerRejected', async (event) =>`

mean opposite things to the dealer — one is the end of the application

### `bus.on('DealerRejected', async (event) =>`

and the other is a task — and a shared message would have to be vague

### `bus.on('DealerRejected', async (event) =>`

about which.

### `bus.on('DealerSuspended', async (event) =>`

4 — suspension and reinstatement are both reversible account events,

### `bus.on('DealerSuspended', async (event) =>`

and both must be visible to the dealer.

### `bus.on('DealerProfileChangeSubmitted', async (event) =>`

5 — a dealership proposes new public words: tell the moderators.

### `...(typeof payload.profileChangeId === 'string'`

The proposal, not the live page — see `profileChangeId` above.

### `bus.on('DealerProfileChangeDecided', async (event) =>`

6 and 7 — the decision on it. One event carries both verdicts, because

### `bus.on('DealerProfileChangeDecided', async (event) =>`

R34 chose one event for "this dealership's public words were decided

### `bus.on('DealerProfileChangeDecided', async (event) =>`

on"; `payload.published` is which way.

### `async work(): Promise<void>`

Registers the worker. Called by whichever process runs the handlers.

### `handleEmailJob`

Exported for the tests, which drive it directly rather than through pg-boss.

### `async function handleEmailJob(job: EmailJob): Promise<void>`

One job, one email — or none, if this one has already been sent.

The order below is the whole idempotency argument and is not rearrangeable:

1. **Claim first.** Insert the `PENDING` row. The unique index on
   `dedupeKey` is what makes a duplicate delivery lose rather than send,
   and it has to happen _before_ the provider is called — a claim taken
   afterwards would be a claim on an email that has already gone.
2. **Resolve the recipient.** From the database, at send time.
3. **Send.**
4. **Record the outcome.**

Step 1 failing on the unique index is the normal, expected path for a
redelivery. It is logged at `debug` and returns — not an error, because
nothing went wrong.

### `if (job.template === 'dealer.application.rejected')`

Rejection is the one notification whose subject is deliberately gone
before the outbox is published. Its non-FK audit snapshot survives the
purge and is therefore the source of both recipient and rendering data.

### `null`

The dealer row no longer exists. A nullable delivery reference

### `null`

preserves the send record without violating its foreign key.

### `logger.warn({ template: job.template, dealerId: job.dealerId }, 'email skipped — no dealer')`

The dealership was purged between the event and the job. Nothing to

### `logger.warn({ template: job.template, dealerId: job.dealerId }, 'email skipped — no dealer')`

say and nobody to say it about; this is not a failure to retry.

### `const proposal = job.profileChangeId`

The proposal, when the message is about one.

A moderator reading "has proposed a change" over the dealership's _current_
tagline is reading the words the dealer wants to replace. That was a real
bug, caught by the integration test rather than by review, and it is the
reason this read exists rather than the row above it being reused.

### `let claimed`

1 — claim. A duplicate loses here, before anything is sent.

### `if (existing?.status === 'SENT')`

Already sent — a redelivery, which is the queue behaving correctly.
Not an error, and not retried.

### `await prisma.notificationDelivery.update(`

A PENDING or FAILED row is this job's own earlier attempt coming
round again. Count it and carry on: the point of a retry is to try.

### `'email accepted by provider'`

This is provider acceptance, not an inbox-placement claim. Resend

### `'email accepted by provider'`

cannot see whether Gmail subsequently chooses Inbox or Spam.

### `status: permanent ? 'FAILED' : 'PENDING'`

Permanent means the retries would all fail the same way, so the

### `status: permanent ? 'FAILED' : 'PENDING'`

row goes straight to the list somebody works.

### `if (!permanent) throw error`

A permanent failure is swallowed _deliberately_. Rethrowing would make
pg-boss retry five times over twenty minutes to receive the same 422
from Resend, and then archive a job nobody looks at — while the row
that says what went wrong already exists. Anything else is rethrown, so
the queue's backoff does its job.

### `async function recipientsFor(job: EmailJob): Promise<{ email: string; name: string | null }[]>`

Who to write to, resolved at send time rather than carried on the job.

A `dealer` audience is the OWNER's address — the person who applied, and
the only seat that can act on any of these messages. An `admin`
audience is `ADMIN_ALLOWLIST`, which is the same list that decides who may
hold an admin session: a moderation queue email going to somebody who
cannot open the queue would be a leak with no purpose.

### `const recipientEmail = stringOf(before.recipientEmail) ?? stringOf(before.contactEmail)`

`contactEmail` supports audit rows written before `recipientEmail`

### `const recipientEmail = stringOf(before.recipientEmail) ?? stringOf(before.contactEmail)`

was introduced, so already-queued rejection events remain deliverable.

### `function base(event: DomainEvent, template: TemplateName, audience: 'dealer' | 'admin'): EmailJob`

The fields every job shares, off the event that caused it.

### `subjectId: event.id`

The event id. One event, one email per recipient, however many times the

### `subjectId: event.id`

outbox or the queue delivers it.

### `function reasonOf(event: DomainEvent): string | null`

The moderator's own sentence, when the event carries one.

### `function isUniqueViolation(error: unknown): boolean`

Prisma's P2002. Duck-typed, so a test can throw one without the client.

## `apps/api/src/modules/notifications/templates.ts`

### `export type TemplateName =`

Transactional messages, as data (**R40**).

── Why they are functions and not files ────────────────────────────────────
These short transactional emails do not need a templating engine, a build step
or a directory of `.mjml`. They need to be readable next to the rule that
sends them, diffable in a pull request, and impossible to render with an
`undefined` in the middle of a sentence — which a typed function gives and a
string file does not.

── Both bodies, always ─────────────────────────────────────────────────────
Every message carries `text` as well as `html`. Not for taste: a message with
no plain-text part scores worse with every spam filter that looks, and the
console driver prints the text body — so the part a developer reads while
checking a template is the part a filter reads while deciding whether the
dealer sees it at all.

── The HTML is deliberately plain ──────────────────────────────────────────
Tables, inline styles and a 600px column, because that is what mail clients
render. No external stylesheet, no web font, no image: Outlook strips the
first two and a third of readers block the third. What survives everywhere is
a paragraph, a heading and a link that looks like a button.

### `export interface TemplateContext`

Everything a template may read. Ids are resolved by the worker, never here.

### `reason?: string | null`

The moderator's own sentence, verbatim. Never paraphrased.

### `tagline?: string | null`

What the dealer proposed, for the two profile-change messages.

### `case 'dealer.application.rejected':`

A rejection is the message that most needs to be honest and the least
likely to be read twice, so the moderator's reason is the second thing on
the page — above the button and below the sentence that says what
happened.

### `function proposalOf(context: TemplateContext): string | null`

The tagline and the services, as one readable block.

### `quote?: string | null`

A moderator's sentence, or a dealer's proposal. Rendered as a quoted block.

### `function compose(parts: Composition): RenderedEmail`

One shape for every template, so a new message cannot arrive with a different
footer, a different width or a missing plain-text body.

`escape` runs over every interpolated value without exception. None of them
is attacker-controlled _today_ — they are dealership names and moderator
notes — but a dealership name is typed by a dealer, and "no user input
reaches this template" is a property that stops being true the first time
somebody adds a field.

### `function quote(value: string): string`

A moderator's own words, set apart so they are not mistaken for ours.

### `function button(label: string, url: string): string`

A table, not an `<a class="btn">`. Outlook renders the anchor as unstyled
text; a single-cell table with a background is the shape that survives every
client, and it is why transactional email still looks like 2005 HTML.

### `function indent(value: string): string`

Two spaces, so a quoted note is visibly not the sentence around it.
