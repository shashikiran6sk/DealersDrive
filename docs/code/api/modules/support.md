# api / modules/support

Parent: [api](README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/support/support.service.ts`

### `export function createSupportService({ prisma, audit }: SupportDeps)`

**R90** — a customer asking Dealers-Drive itself for help. It is its own domain
on purpose, not a kind of enquiry: an enquiry is a customer talking to a
dealership, and a support request is a customer talking to us. Folding the two
into one table would have made every dealer inbox read past support traffic,
and every support read past leads.

**Who is asking is the session.** Every read and write is keyed by
`customer.userId`; there is no customer field in any input, and another
customer's ticket is a 404 — the same answer as one that does not exist, so a
`DD-` number or a row id cannot be probed.

### `if (input.enquiryId) { … tx.enquiry.findFirst({ where: { id, customerId } }) … }`

A request may point at one of the customer's **own** enquiries — that single
reference is how support reaches the dealership and the car without either
being copied onto the ticket (`enquiry → listing → dealer`). An id that is not
theirs is refused exactly as one that does not exist,
`422 SUPPORT_ENQUIRY_INVALID`, with the same sentence: telling the two apart
would confirm somebody else's enquiry exists.

### `number` and `supportTicketReference`

The human reference, `DD-1042`, comes from the `support_tickets.number`
sequence (SERIAL, restarted at 1001). A sequence hands each value out once even
to concurrent inserts, so two requests created in the same instant never share
a number — the race a `count + 1` would have. The row id is a UUID and is never
shown as the reference.

### `description` vs `SupportTicketMessage`

The customer's opening text is stored once, on the ticket. Replies are
`support_ticket_messages` rows. The conversation is drawn as the description
followed by the messages, so nothing is stored twice and the original request
cannot be edited by adding a message.

### `async reply(customer, ticketId, input)`

The ticket row is locked `FOR UPDATE` first, so a customer's reply and an
operator's status change serialise: the reply always applies its rule to the
status the ticket actually has. The rule itself is `statusAfterCustomerReply`
in contracts — waiting on the customer goes back to `IN_PROGRESS`, resolved
reopens to `OPEN`, closed refuses (`409 SUPPORT_TICKET_CLOSED`). A move caused
by a reply is audited with the customer as the actor and
`cause: 'customer_reply'`.

`updatedAt` is set by every message as well as every change, so lists sorted by
it show the ticket that last had activity first.

### `audit.record(… 'support_ticket.created' …)`

The audit row carries the number, category, status and enquiry — never the
subject, description or a message. Those are the customer's words and live in
their own columns; copying them into a JSON column read by every audit query
would spread them further than they need to go. For the same reason the log
line carries the ticket id only.

No notification is sent from here (deferred). The audit rows and the message
rows are the events a later notification PR subscribes to.

## `apps/api/src/modules/support/support.mapper.ts`

### `export const CUSTOMER_TICKET_SELECT`

The customer's response is built from a `select`, not from a full row with
fields deleted afterwards. Priority, assignment and internal notes are never
read for a customer request, so a later change to the mapper cannot leak them.

### `authorLabel`

Every support reply reads as "Dealers-Drive support". The customer is not told
which operator answered, and the operator's id is not in the response.

## `apps/api/src/modules/support/routes/post-ticket.ts`

### `rateLimit('support.tickets.create.customer', { limit: 5, … })`

Five new requests per customer per hour, and twenty per IP. Generous enough
that a customer with several real problems is never stopped, tight enough that
a script cannot fill the queue. Replies allow thirty an hour per customer.
