# web / app/(admin)/admin/dealers/[id]

Parent: [web](../../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/(admin)/admin/dealers/[id]/page.tsx`

### `export default async function AdminDealerPage({ params }: { params: Promise<{ id: string }> })`

D3 — the full dealer record, its documents, its ledger and its actions.

### `</div>`

There is deliberately no "Public page" link here.

The baseline carried one, pointing at `/dealers/{slug}` — a route that
belongs to the public dealer profile and does not exist yet, so every
press of it was a 404. A link that cannot work is worse than no link:
a moderator clicking it concludes the dealership is broken rather than
that the page has not been built. It comes back with the route.

### `{/*`

Two cards side by side, and the documents underneath at full width.

The three used to share one auto-fit row, which meant the KYC checklist
— the thing this screen exists for — was squeezed into a third of the
page. Every row on it carries a label, a view link, two decisions, a
status tag and, when a moderator is rejecting, a reason field: it wraps
into four lines per document at that width and the buttons end up under
the file name they belong to. Business and Yard photo are short,
read-only and pair naturally; the checklist is the working surface and
gets the width.

### `{dealer.profileChange ? <ProfileChangeReview change={dealer.profileChange} /> : null}`

The proposed change, above the record it would change (**R34**).

Full width and ahead of the two-card row on purpose: it is the only
thing on this screen that somebody is _waiting_ on. A moderator opening
a dealership has a reason for being here — usually the queue or the
badge in the list — and a review card tucked into a third of a row
below the KYC checklist is one that gets scrolled past.

It renders only when there is something waiting. `profileChange` is
PENDING-only on the response, so a decided edit simply stops appearing.

### `<section className="card gap-2 p-4">`

The yard photograph.

It is the image that will front this dealership's public portfolio,
and the only question the requirement exists to ask — "is this
actually a clear photograph of the premises" — is one a person has to
answer. `yardPhotoUrl` is a short-lived signed read, like the KYC
documents beside it.

### `{dealer.mapsUrl ?`

The pin, next to the picture, because they answer the same question
from two sides: is there really a yard, and is it where the address
says. The link opens in a new tab with `noreferrer` — it is a URL a
dealer supplied, and the API has already refused anything that is
not an https Google Maps host.
