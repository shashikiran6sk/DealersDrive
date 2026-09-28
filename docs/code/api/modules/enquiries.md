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

### `where: { ...PUBLIC_LISTING_WHERE, id: listing.id },`

The same visibility rule the public pages use, imported from the search
module's facade rather than restated. An enquiry must be possible for exactly
the cars a buyer can see, and two copies of that rule would one day disagree.
Read inside the transaction that writes the enquiry.

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

### `export const DUPLICATE_WINDOW_HOURS = 24`

One enquiry per customer per car per day. It stops a customer flooding a
dealer's inbox with the same lead, and does not stop a genuine follow-up the
next day, a different car, or a different customer. The refusal says the
dealership already has their details, because it does.

## `apps/api/src/modules/enquiries/routes/post-enquiry.ts`

### `export const postEnquiry: EnquiriesRoute = (router, { service, rateLimit }) =>`

Two limits: ten an hour per customer — a person does not enquire about more
cars than that in an hour — and thirty an hour per address, so one address
cannot cycle through throwaway accounts. The duplicate guard in the service
is the per-car limit; these are the overall ones.
