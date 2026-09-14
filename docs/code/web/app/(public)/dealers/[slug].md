# web / app/(public)/dealers/[slug]

Parent: [web](../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/(public)/dealers/[slug]/page.tsx`

### `export const revalidate = 600`

RSC + ISR 10 min — SEO (ARCHITECTURE §15.1).

### `async function loadDealer(slug: string): Promise<DealerPublicProfile | null>`

`/dealers/[slug]` — one dealership's public page.

── Reconstruction slice ────────────────────────────────────────────────────
The baseline page has three sections. **Two of them land here in full**,
because `GET /v1/dealers/:slug` (**F085**) already answers with everything
they render: the header block, and the details / location row.

The third is the inventory, and it cannot land yet. It needs
`GET /v1/dealers/:slug/vehicles` and `/facets` — both **F076**, over the
`listing_search` read model **F064** creates — plus `VehicleCard` (**F075**),
`FilterPanel` (**F078**), `SearchToolbar` (**F080**) and `MobileFilterSheet`
(**F079**). Nothing on the platform can create a listing until Tier 9 and
Tier 10 land, so there is no inventory to filter and no facet to count.

What stands in its place is **not a stub**: it is the empty state this page
would show anyway for a dealership that has listed nothing, and today that is
every dealership. `dealer.stats` already carries `Cars available: 0` from the
same endpoint, so the page does not contradict itself. When F076 lands, the
grid, the filter rail and the toolbar replace the `EmptyState` below and
nothing else on this page changes.

Two more absences, both deliberate and both conditional in the baseline too:

· **`RevealContactButton`** (**F090**) rides on a vehicle — A7 is
vehicle-scoped and is the only endpoint that yields a phone number. The
baseline renders it only when `inventory.data[0]` exists, so an empty
yard has never shown it.
· **`EnquiryForm`** (**F089**), and with it the "Enquire with dealer"
button that anchors to it. A button jumping to an anchor that is not on
the page is worse than no button, so both arrive together.
────────────────────────────────────────────────────────────────────────────

### `tags: [dealerTag(slug), DEALERS_TAG]`

Both tags. `dealer:<slug>` is what this dealership's own save clears;
`dealers` is what a moderation decision clears, because approving or
suspending changes whether this page may exist at all — and a suspended
dealership's portfolio staying up for ten minutes is the one stale
window here that is not merely untidy.

### `description:`

The tagline, where the `about` paragraph used to be (**R25**).

It is the better of the two for this slot anyway: a meta description is
cut at about 160 characters, and `about` allowed 4,000 — so what a search
result actually showed was the first sentence and a half of an essay,
mid-clause. A tagline is capped at 200 and is already written to be one
line, which is what this field is for.

### `...seoMetadata(`

A9 resolves indexability (ACTIVE and ≥1 live listing); the policy

### `...seoMetadata(`

function turns that into robots + canonical (§17.2). Every dealership is

### `...seoMetadata(`

therefore `noindex, follow` until F064 — which is right: a portfolio with

### `...seoMetadata(`

nothing in it is a page a search engine should not send anybody to.

### `<div className="border-b border-(--color-divider) bg-white">`

── 1. Header block ───────────────────────────────────────────────

### `{dealer.tagline ?`

The dealership in its own words, directly under its name (**R25**).

`body-lg` — 16px/1.5 — which is the size DESIGN-SPEC §1.3 gives a
lead paragraph, and the register this line is in: bigger than the
14px address beneath it because it is the sentence, smaller than
anything that would compete with the 34px name above it. Not
`ink-secondary` like the address either; the address is a
reference detail and this is prose meant to be read, so it keeps
the body's own ink at weight 500 and lets the address recede
beneath it.

Nothing is rendered when there is none — an empty line between a
name and an address reads as a broken page rather than as a
dealership that has not written one.

### `<div className="mx-auto max-w-[1280px] px-6 pb-[20px]">`

The yard, last in the header (R13, R15). It was a 170px strip above
the name, which is where a _logo_ belongs — a banner, glanced past on
the way to the text. Below the identity block it reads the other way
round: a buyer reads who this is, and then wants to see the place.

R15 puts it in the same column as everything else on the page. It ran
the full 1280px while every block above and below it is that width
including* its 24px gutter, so the photograph alone hung 24px past
both margins — the one element on the page that did not line up. It
is inset now, and taller by the 80px the stats grid above it used to
occupy, so nothing was traded for the alignment.

### `<img src={dealer.coverUrl} alt="" className="h-full w-full object-cover" />`

The 1600px rendition — this is the one place a yard photograph
is looked at rather than glanced past. See `dealer-card.tsx`
for why it is a plain `<img>` and why the alt is empty.

### `<ImageSlot label="Dealership frontage / yard photo" />`

A dealership that has not uploaded one yet.

### `<div className="mx-auto grid max-w-[1280px] gap-4 px-6 pt-6 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">`

── 2. Info row ───────────────────────────────────────────────────

### `<section className="card p-[14px]">`

One card, not two. The introduction and the services chips were a
card of their own — "About the dealership" — standing beside this one,
and the pair said a single thing in two frames: who this dealership
is. That cost a whole card's chrome to separate a sentence from the
facts it makes claims about, and put the info row at three columns on
a page with two things in it, so on a laptop the map ended up the
narrowest of the three.

_The introduction itself is gone (R25)._* It was a paragraph of up to
4,000 characters that opened the card, and what replaced it is the
tagline in the header — one line, above the fold, where a buyer
actually reads it. A page that says who this dealership is in a
photograph, a name, a line, an address and a service list does not
also need an essay, and the essay is the part nobody wrote well.

What is left is what the card was always better at: the facts, then
what the yard actually does. The services stay last and below a
hairline, because they are a set rather than a row in the list above
them, and `mt-auto` keeps them on the floor of the card when the map
beside it is the taller of the two.

The full service list lives here and nowhere else. The directory card
shows the first three — the API slices to three as well — and this is
where a buyer who clicked through sees the rest.

### `<div className="mx-auto max-w-[1280px] px-6 pb-[60px] pt-[26px]">`

── 3. Inventory ──────────────────────────────────────────────────

### `<EmptyState`

The filter rail, the toolbar and the card grid belong here — F078,
F080/F079 and F075, over F076's two endpoints. See the note at the top
of this file: what is below is the empty state this page would show
anyway for a dealership that has listed nothing, which today is every
dealership on the platform.

### `function detailRows(dealer: DealerPublicProfile): DetailRow[]`

One list, not a grid and a list (R15).

The four stats were four bordered cards across the header — "Cars available",
"Years operating", "Location", "Response time" — set in 28px type, which is
the weight a page gives a number a buyer came for. Nobody comes to a
dealership page for the number 27. They are facts about the dealership in
exactly the register of its GSTIN and its opening hours, so they read as rows
beside them, and the header is left to do the one thing only it can: say who
this is and show the yard.

`location` is dropped rather than moved. `contact` already carries a City row
with the state on it, and the stat is the same town said a second time — a
duplicate that was invisible while the two lived in different blocks and
would be conspicuous inside one list.

The API composes both arrays and neither is re-derived here: `value || '—'`
is the em dash the stat cards used for an empty value, kept because a blank
`<dd>` beside a label reads as a rendering fault rather than as "not known".

### `function carCountLabel(dealer: DealerPublicProfile): string`

The count, from the stat the API already composed rather than from a second
derivation of the same fact.

### `function DealerJsonLd({ dealer }: { dealer: DealerPublicProfile })`

`AutoDealer` + `BreadcrumbList` (ARCHITECTURE §17.3), phone deliberately
absent — structured data is the easiest place in a page to leak a field
nobody meant to publish, and rule 7 applies to it exactly as it does to the
rendered document.

The baseline emitted a `geo` block from `dealer.address.lat/lng`, and those
were the _town's_ coordinates off a `cities` row **D6** removed — a claim
about a place that is not the dealership.

`address.geo` is the yard now, read out of the dealer's own share link, and
it is still not published here. A `GeoCoordinates` block is read by machines
that will not check it, and these coordinates come from a link a dealer
pasted rather than from anything surveyed: good enough to centre a map a
person is looking at, not good enough to assert to a search engine. The map
is in `LocationCard`; `mapsUrl` (R6) is in the anchor beside it.
