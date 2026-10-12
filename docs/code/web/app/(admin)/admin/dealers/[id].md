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
the file name they belong to. Business details and the portfolio summary
are short, mostly read-only and pair naturally; the checklist is the
working surface and gets the width.

### `{dealer.profileChange ? <ProfileChangeReview change={dealer.profileChange} /> : null}`

The proposed change, above the record it would change (**R34**).

Full width and ahead of the two-card row on purpose: it is the only
thing on this screen that somebody is _waiting_ on. A moderator opening
a dealership has a reason for being here — usually the queue or the
badge in the list — and a review card tucked into a third of a row
below the KYC checklist is one that gets scrolled past.

It renders only when there is something waiting. `profileChange` is
PENDING-only on the response, so a decided edit simply stops appearing.

### `async function yardVisitsFor(id: string): Promise<YardVisitDto[] | null>`

The internal yard visits are fetched separately from the dealer (the detail
carries only `yardVisitCount`) because they have their own permission,
`admin:visit:manage`, which a Support admin does not hold. A 403 is turned into
`null` and the panel renders nothing; any other failure still fails the page,
as every other read on it does. The signed photograph URLs are minted per read,
so nothing here is cached.

### `<ManualActivationNotice activation={dealer.activation} />`

Directly under the name and status, ahead of everything else: a dealership
activated by a Super admin's override is live without verified documents, and
every later reviewer should know that before reading anything else (**#299**).
It renders nothing for a standard approval.

### `<DealerPortfolioSummary photos={dealer.portfolio} dealerSlug={dealer.slug} />`

In the place the "Yard photo" card used to hold. Yard photographs left
onboarding in #299 — a yard is neither required nor evidence of anything a
buyer relies on — and the dealership's own public imagery is now its
moderated portfolio, decided in the portfolio queue and summarised here.

### `{dealer.mapsUrl ?`

The pin, under the dealership's name. It used to sit beside the yard
photograph because the two answered the same question; with the photograph
gone it belongs with the dealership's identity. The link opens in a new tab
with `noreferrer` — it is a URL a dealer supplied, and the API has already
refused anything that is not an https Google Maps host.
