# api / modules/enquiries

Parent: [api](../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/enquiries/enquiries.service.ts`

### `export function createEnquiriesService({ prisma, audit }: EnquiriesDeps)`

**R64** — a signed-in customer asks a dealership about one car (revises F088).

The whole design is what the request does **not** carry. The customer is the
session (`CustomerPrincipal`, R62); the dealership is the listing's; the name
and number the dealer will see are read from the customer's `users` row when
the inbox renders them (R66). So there is nothing in the body a client could
set to make an enquiry arrive as somebody else, or at another dealership, or
with a number nobody proved.

### `const listing = await prisma.listing.findUnique({`

Two reads, two answers. A slug that was never a listing is `404`; a listing
that exists but is not on the marketplace right now — sold, removed, rejected,
still in review, or on a suspended dealership — is `409 LISTING_NOT_AVAILABLE`.
The second is the case a buyer actually meets: the page was open when the car
sold, and the press arrived afterwards.

### `where: { ...PUBLIC_AVAILABLE_LISTING_WHERE, id: listing.id },`

The available rule the public counts use (**R71**), imported from the search
module's facade rather than restated. An enquiry must be possible for exactly
the cars a buyer can act on, and two copies of that rule would one day
disagree. A reserved car is visible but not available: it is refused as
`409 LISTING_RESERVED`, with its own sentence, so the buyer learns why rather
than being told the car is gone.

The listing row is read `FOR SHARE` first. A dealer's reservation, sale or
withdrawal takes the row `FOR UPDATE`, so the two serialise. Either the move
lands first and the enquiry reads the new status and is refused, or the
enquiry commits first and the move waits for it. An enquiry about a car that
was already sold at the moment of writing cannot happen.

### `if (ownDealership) throw new DomainError('ENQUIRY_OWN_LISTING', OWN_LISTING)`

A dealer session counts as a customer (R62), so a dealer browsing the
marketplace can enquire about another dealership's car as the person they are.
Their own dealership's cars are refused: that is not a lead, and it would sit
in their own inbox as one.

### `await tx.$executeRaw\`SELECT pg_advisory_xact_lock(`

The duplicate guard is a read followed by a write, and a double-tap on a slow
phone sends two of them at once. The advisory lock, keyed by customer and
listing, serialises exactly that pair for the length of the transaction —
so the second press sees the first enquiry and is refused — without making
unrelated enquiries wait for each other.

### `export const BLOCKING_STATUSES = ['NEW', 'CONTACTED', 'SPAM']`

**One open enquiry per customer per car (R68)**, replacing R64's 24-hour
window. While the customer has an enquiry about this car that the dealership
has not closed, a new one is `409 ENQUIRY_ALREADY_OPEN`: the dealership
already has their details, and time passing does not change that. Once the
dealership **closes** it, the door reopens — closing is the dealership saying
it is finished with this lead, so a new question is a new lead.

**Spam keeps blocking**, although the customer sees it as Closed. Letting a
customer the dealership marked as spam straight back in would make marking
spam pointless; showing it as spam would tell a spammer to change tactics. A
different car, or a different customer, is unaffected.

A dealership that **reopens** a closed enquiry after the customer has sent a
new one ends up with two open enquiries from that customer about the car.
That is the dealership's own choice and nothing is lost, so it is not refused.

### `async mine(customer: CustomerPrincipal, query: CustomerEnquiryQuery)`

The customer's own enquiries, newest first (**R68**) — filtered by the
session's user id, never an id in the request. Every status is listed,
including spam, because the customer should see every enquiry they sent; how
each is shown is the mapper's job.

## `apps/api/src/modules/enquiries/enquiries.mapper.ts` — the customer's view

### `export function toCustomerEnquiry(row: CustomerRow): CustomerEnquiry`

Three states, not four: `customerEnquiryStatus` folds `NEW` into `SENT` and
`SPAM` into `CLOSED` **here, on the server**, so no customer response carries
the word spam — the page could not leak it if it tried. The current state
only; there is no history of moves, which is the dealership's audit log and
not the customer's business. The car links to its public page only while it
is live, the same rule the inbox uses.

## `apps/api/src/modules/enquiries/routes/get-my-enquiries.ts`

### `export const getMyEnquiries: EnquiriesRoute`

`GET /v1/enquiries`, on the same customer-guarded router as the POST, so a
dealer's session reaches it as the customer that dealer also is (R62).
`no-store`, like every answer that is about one person.

## `apps/api/src/modules/enquiries/routes/post-enquiry.ts`

### `export const postEnquiry: EnquiriesRoute = (router, { service, rateLimit }) =>`

Two limits: ten an hour per customer — a person does not enquire about more
cars than that in an hour — and thirty an hour per address, so one address
cannot cycle through throwaway accounts. The duplicate guard in the service
is the per-car limit; these are the overall ones.

## `apps/api/src/modules/enquiries/enquiries.mapper.ts`

### `export const INBOX_SELECT`

The dealer's view of an enquiry (**R66**). The customer's name and phone are
selected from `users` at read time, not copied onto the enquiry: the phone is
written only by a completed OTP (R39), so the number the dealer rings is the one
the customer proved; and a corrected name is the same lead, so the inbox should
show the correction rather than preserve the mistake.

### `function publicHref(listing: InboxRow['listing'])`

The car links to its public page only while that page exists — listing
visible (`ACTIVE` or `RESERVED`, **R71**) and dealership `ACTIVE`, the pair
`PUBLIC_VISIBLE_LISTING_WHERE` tests. A sold or withdrawn car's enquiry stays in
the inbox with its title and plate, but without a link that would 404.

### `export function toDealerEnquiry(row: InboxRow, now: Date = new Date())`

`phone` is nullable because `users.phone` is: an account whose number has since
been released has no number to call, and the card then offers no Call button
rather than a `tel:` that dials nothing. `now` is passed once per page so every
row's "18 min ago" is measured from the same instant.

## `apps/api/src/modules/enquiries/enquiries.service.ts` — the inbox

### `async inbox(dealerId: string, query: DealerEnquiryQuery)`

`dealerId` is the session's, never a parameter a client names (rule 1), and it
is the first term of every `where` here. Newest first, cursor on `createdAt`
like the inventory. The counts come from the same `groupBy` the counts route
uses and ignore the tab, so switching tab never empties the bar.

### `async setStatus(actor: EnquiryActor, enquiryId: string, input: UpdateEnquiryInput)`

The row is locked `FOR UPDATE` **by id and dealership together**, so another
dealership's enquiry is not found — a 404, never a 403, and nothing about it is
revealed — and two people on one dealership pressing at once are serialised:
the second sees the first's status and, if it asked for the same one, changes
nothing. Without the lock both read `NEW` and both write an audit row.

Any status may follow any other, so a mistaken Close or Spam is undone by
choosing the right one; there is no state machine to argue with. A move to the
status an enquiry already has returns it unchanged and audits nothing, so a
double press leaves one record.

### `function stampsFor(current, status, now)`

`contactedAt` is the **first** contact and is kept through a close and a
reopen — it answers "how long did we take to call back", which a later press
should not rewrite. `closedAt` is the current close only, cleared on reopen.

### `const STATUS_AUDIT_ACTIONS: Record<EnquiryStatus, string>`

One audit action per move — `enquiry.contacted`, `enquiry.closed`,
`enquiry.spam`, `enquiry.reopened` — each against the dealership, with the
member who moved it and the status before and after.

## `apps/api/src/modules/enquiries/enquiries.dealer.routes.ts`

### `export function createDealerEnquiriesRouter(service: EnquiriesService)`

Mounted inside the dealer router, so `requireDealer` has already run;
`enquiry:read` and `enquiry:update` are the permissions every seat in the
baseline's role table already held. `/enquiries/counts` is registered before
`/enquiries/:id`. Every answer is `no-store` — it carries customers' numbers.

## `apps/api/src/modules/enquiries/enquiries.admin.service.ts`

### `export function createAdminEnquiriesService({ prisma }: { prisma: PrismaClient })`

**R89** — admin oversight of enquiries, and the reason it is a second service
rather than more methods on the first. The customer's and the dealership's
reads are each scoped by the session: one by `customerId`, the other by
`dealerId`. This one is scoped by nothing but the admin guard, and keeping it
apart means no method of the scoped service can ever grow an "or every
dealership" branch. It reads the **same rows** — there is no admin copy of an
enquiry — and it writes nothing. An admin cannot change an enquiry's status;
the dealership's inbox stays the only place it moves, so the workflow and its
semantics are exactly what R66 made them.

A page view is not audited. Oversight is read-only and frequent, and an audit
row per look would bury the rows that record something happening.

### `const scope: Prisma.EnquiryWhereInput = { AND: filters }`

Every filter except `status`. The list reads `scope` plus the status and the
cursor; the tab counts group `scope` by status. So the tabs always describe the
enquiries being looked at — a search for one customer shows how many of _their_
enquiries are in each tab — and switching tab never empties the bar.

### `OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, id: { lt: cursor.id } }]`

A keyset on `(createdAt, id)`, not the bare `createdAt` cursor the dealer inbox
uses. Across every dealership two enquiries sent in the same millisecond are
plausible, and a cursor on the timestamp alone would skip the second. The
order is `createdAt desc, id desc`, matched exactly by the predicate.

### `export function enquirySearch(raw: string | undefined)`

One box for the questions support actually asks: _which enquiry was Meera's_,
_what did 98400 send_, _what has Sri Lakshmi received_, _who asked about
TN 09 BX 0001_. The mobile number is matched only from three digits, so a
search for a model year or a two-digit fragment does not drag in every number
containing it. The plate is matched in the stored, separator-free form, as the
moderation queue matches it.

### `export function enquiryWindow(from, to)`

The two dates are IST calendar days — what the operator sees on the wall — and
both are inclusive: `to` becomes the first instant of the next IST day,
exclusive.

### `prisma.auditLog.findMany({ where: { entityType: 'Enquiry', … } })`

**The history is the audit trail.** Every enquiry has written
`enquiry.created` since R64, and every status change has written one of
`enquiry.contacted`, `.closed`, `.spam` or `.reopened`, with the actor and the
status before and after (R66). That is already the status-event log the
oversight page needs, so there is no second table to keep in step with it and
nothing to backfill. An enquiry the trail has nothing on shows no history; it
is never given one reconstructed from its timestamps.

## `apps/api/src/modules/enquiries/enquiries.admin.mapper.ts`

### `function previewOf(message: string | null)`

The list shows the first non-blank line, cut at 120 characters, so a customer
who wrote a paragraph does not make every row a paragraph tall or ship a
thousand characters per row to a page that shows forty of them. The whole
message is on the detail.

### `customerStatusLabel`

What the customer's own page says, beside what the dealership set. They differ
for spam, which the customer sees as Closed (R68). In a dispute — "the dealer
never answered" — an operator needs to know both what happened and what the
customer was shown.

### `adminHref` · `publicHref`

A listing is never deleted by the lifecycle, so the review screen link always
resolves. The public page exists only while the car is on the marketplace; for
a sold, withdrawn or suspended car it is null, and the console says so rather
than linking to a 404.
