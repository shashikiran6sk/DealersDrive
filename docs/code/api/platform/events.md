# api / platform/events

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/platform/events/bus.ts`

### `export interface DomainEvent<T = unknown>`

The event envelope. Fixing this now is cheap; changing it after forty
side-effecting flows is not (ARCHITECTURE §19.2).

### `| 'DealerProfileChangeSubmitted'`

R34. A moderator decided on a dealership's proposed tagline or service
list. `payload.published` says which way, because the two mean opposite
things downstream: an approval changed what buyers see and a refusal
changed only what the dealer is told.

One event for both verdicts rather than two, for the reason the dealer
status machine emits one per transition: a consumer that cares about "this
dealership's public words were decided on" should not have to subscribe
twice and keep the pair in step.

### `| 'DealerProfileChangeSubmitted'`

R40. A dealership has proposed new public words and a moderator has not
looked yet. Distinct from `DealerProfileChangeDecided`, which is about the
far end of the same request: this one is addressed to the queue, that one
to the dealer.

### `publish(event: DomainEvent): Promise<void>`

Publishes to every subscriber. A failing subscriber never rolls the caller back.

### `logger.error`

Rule: a subscriber never throws into the publisher.

### `export async function enqueueOutbox(tx: Tx, write: OutboxWrite): Promise<void>`

Writes the event into the outbox **inside the caller's transaction**.

Without this, "save the listing, then send the email" has two failure modes:
an email for a listing that rolled back, or a listing saved with no email.
One table, and it makes the side effect exactly as durable as the state
change that caused it.

Payloads carry ids, never PII — the handler re-fetches.

### `payload: event as unknown as Prisma.InputJsonObject`

Prisma's `InputJsonValue` demands an index signature, which a named

### `payload: event as unknown as Prisma.InputJsonObject`

interface does not have even when every field in it is serialisable.

### `payload: event as unknown as Prisma.InputJsonObject`

The cast is the assertion that this event is JSON — it is, by

### `payload: event as unknown as Prisma.InputJsonObject`

construction — and not a widening of the type.

## `apps/api/src/platform/events/outbox-publisher.ts`

### `drain(): Promise<number>`

Drains the outbox once. Tests call this instead of waiting for the timer.

### `export function createOutboxPublisher(prisma: PrismaClient, bus: EventBus): OutboxPublisher`

Reads unpublished outbox rows every two seconds and hands them to the
in-process bus. `FOR UPDATE SKIP LOCKED` means several workers can drain the
same table without either of them seeing the other's rows.

When the sink becomes a broker, this is the only file that changes.
