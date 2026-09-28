# web / features/dealer/enquiries

Parent: [web](../../README.md)

The dealership's inbox (**R66**, revises F091). The baseline built it on
`@tanstack/react-query` with a BFF route; this one follows the inventory's shape
instead (R47): a server component reading `GET /v1/dealer/enquiries` with the
tab in the URL, so a refresh or a shared link shows the same list, and the only
client code is the row of status buttons.

## `apps/web/src/features/dealer/enquiries/enquiry-inbox.tsx`

### `export function EnquiryInbox({ inbox, status }: EnquiryInboxProps)`

DESIGN-SPEC §3.15: `h1-app`, the `.seg` tabs New / Contacted / Closed / Spam
with counts, a list with `gap:10px`. There is no "All" tab — §3.15 draws four,
and a dealer works one queue at a time — so the page opens on New. Each tab has
its own empty sentence, because "nothing here" means something different on
New than on Spam.

## `apps/web/src/features/dealer/enquiries/enquiry-card.tsx`

### `export function EnquiryCard({ enquiry }: EnquiryCardProps)`

§3.15's card: identity row (34px avatar, name, mono phone, time), the message
line with the car in bold, and the action row on a divider with `Call {phone}`
first — full-width and 44px below `sm`, as §3.15 asks at 375. Two departures:
there is no **Email** button, because customers have no email (R62); and the
source tag is the status tag, because every enquiry now has one source.

The phone carries `Verified` because only a completed OTP writes it. The car is
a link only while it is on the marketplace (the API sends `href: null`
otherwise). A message-less enquiry says the customer asked to be contacted
rather than leaving a blank line.

## `apps/web/src/features/dealer/enquiries/enquiry-status-actions.tsx`

### `export function EnquiryStatusActions(...)`

The moves that make sense from where an enquiry is (`ENQUIRY_MOVES`): a new one
can be marked contacted, closed or spammed; a contacted one closed or spammed;
a closed one reopened; a spammed one marked not spam. The API accepts any move —
this list is what is worth a button. All buttons disable while one is in flight.
On success the Server Action's `revalidatePath` redraws the page, so the card
moves tab with no client state to keep in step; a refusal shows the API's
sentence under the buttons.

## `apps/web/src/features/dealer/enquiry-actions.ts`

### `export async function setEnquiryStatusAction(enquiryId: string, status: string)`

Parses the id and the status with the contracts' `IdParam` and
`UpdateEnquiryInput` before calling, and sends `{ status }` only. Revalidates
`/dealer/enquiries` on success and nothing on refusal.
