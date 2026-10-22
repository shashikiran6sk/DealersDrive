# web / app/(public)/dealers/[slug]

Parent: [web](../../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/(public)/dealers/[slug]/`

### Why the portfolio has no `loading.tsx` (F114)

The portfolio's inventory filters, sort and pages are URL state on this same page
(`?fuel=PETROL`, `?sort=price_asc`, `?page=2`), so the reason `/cars` and
`/dealers` never had a `loading.tsx` applies here too. R101 gave this route one
anyway, and that was the jump to the top of the dealership that the owner
reported (remediation §8.1).

The mechanism, reproduced against a production build in Chromium and traced to
Next.js 15.5.27's router:

- When a dealership page is first rendered, Next seeds its prefetch cache with an
  entry for that pathname.
- A filter or sort change navigates to the same pathname with new search
  parameters. `getExistingCacheEntry` returns the seeded entry as an **aliased**
  match.
- `handleAliasedPrefetchEntry` takes that path only when the tree has a loading
  component (`hasLoadingComponentInSeedData`), and here `loading.tsx` was that
  component.
- The aliased path never sets `mutable.shouldScroll`, and `handleMutable` defaults
  it to `true`. The `{ scroll: false }` that `SearchNavigationProvider` passes is
  therefore dropped, and `ScrollAndFocusHandler` sets `scrollTop = 0`. The trace
  showed exactly that call.
- Without a loading component the aliased path declines, and the ordinary
  navigation honours `scroll: false`. `/cars` measured the same way kept its
  position.

Moving the page into a route group, so the boundary's key ignored search
parameters, did not help: the build still went to `y = 0`, because the trigger is
the presence of a loading component, not the remount. With the file removed, a
sort from 250px into the inventory stayed in the inventory at 1280px and at 390px,
and Back returned to the earlier position.

On the way into a dealership, feedback now comes from the link that was clicked:
`DirectoryCard`'s and `VehicleCard`'s `LinkPendingIndicator`/`LinkPendingLabel`
(R101). Do not add a `loading.tsx` here again without re-running that check
against the Next.js version in use.

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

### `max-md:self-center` on the name row

**R118.** On a phone the header is a two-column grid with the 60px logo tile
beside the name. The grid aligns to the top (`items-start`) so the address and
tagline rows below line up with each other, which left a one-line name stuck
to the top edge of the tile. The name row alone is centred on the tile, and a
name that wraps still centres as a block.

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

### `<PhotoGallery title={dealer.brandName} photos={heroPhotos(dealer)} strip={false} … />`

The yard is every approved portfolio photograph (#299), in the dealership's
order, in the hero itself — the shared
[`PhotoGallery`](../../../components/ui/photo-gallery.md) the car page uses,
with its arrows, swipe, `1 / 5` position and fullscreen viewer. The hero used
to show only `coverUrl` (the first approved photograph) and a separate
"Photos of the dealership" grid below the details repeated all of them,
the first one twice. One gallery says the same thing once, where a buyer
looks for the yard.

Two settings keep it a banner rather than a car gallery: `strip={false}`
(no thumbnail row under the hero) and `DEALER_HERO_STAGE_CLASS` — the same
440px / 340px / 16:9 proportions the cover band had.

### `function heroPhotos(dealer: DealerPublicProfile): GalleryPhoto[]`

The portfolio, each photograph named by `DEALER_PAGE_TEXT.photoAlt` — the
dealer's caption after the dealership's name, or the dealership and its
position when there is no caption — and carrying the caption for the viewer.
A dealership with a `coverUrl` and no portfolio gets that one photograph,
described by `coverAlt`; with neither, the gallery draws the shared yard
illustration (below). A pending or rejected photograph never reaches
`portfolio` — the API selects `status: 'APPROVED'` only — so there is no
status to check here, and none of them can be shown by mistake.

**Directory cards do not change.** The directory keeps the one standard image
for every dealer (#289) — a grid of dealers is compared at a glance, and one
dealer with a professional photographer and one without should not read as a
difference in the dealerships. A portfolio photograph appears only on the
dealership's own page.

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

### `<DealerInventory dealerSlug={dealer.slug} brandName={dealer.brandName} inventory={inventory} />`

── 3. Inventory (R48) ────────────────────────────────────────────

The dealership's live cars, from `GET /v1/dealers/:slug/vehicles`, as
compact `VehicleCard`s. The heading's count is the response's `page.total`
— the number of cards a buyer can page through — which is the same
predicate the directory card and the "Cars available" row count with, so
the three cannot disagree. The profile and the inventory are fetched
together; if the inventory says the dealership is not listed, the page is
the not-found page like the profile's 404. `?page=` pages the inventory
and the links carry `#inventory` so paging lands on the grid, not the
cover. The filter rail and toolbar (F078/F080) are still deferred with
search.

The inventory fetch is uncached (`revalidate: false`) for the reason `/cars`
is (BUG-113): a stale cache entry is served once more after its window on
Vercel, which showed sold cars on a dealership's page nobody had opened for a
while. The profile above it keeps its own cache.

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

### `<JsonLd nodes={[dealerSchema(dealer), breadcrumbSchema(…)]} />`

Was `DealerJsonLd`, which wrote `JSON.stringify` straight into the `<script>` —
a tagline containing `</script>` ended the element. It is built by
`lib/seo/schemas/dealer.ts` now and serialised safely; the canonical, `url`
and `@id` come from the web app's own origin rather than the API's
`seo.canonical`, so one environment variable decides every URL on the page.

`image` lists every approved portfolio photograph, in order, and falls back
to `[coverUrl]` — the same photographs the hero shows.

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

**F086 part 2.** The inventory's query is the vehicle filters in the URL, read
with `readVehicleSearch(query, 'dealer')` — which never reads a place — and
passed to the dealership's route. Other portfolio parameters are left alone,
and the dealership's `cars` stat is handed down as the "of m" in "n of m cars".

### `export async function generateMetadata({ params, searchParams })`

`seo.isIndexable` (an ACTIVE dealership with an available car) decides the bare
portfolio. A filtered or sorted inventory is `noindex, follow`, canonical to
the portfolio; a later page of it is its own canonical, so the cars on it stay
reachable by links. The description leads with the dealer's own tagline and
names the place from the three address parts, without repeating a town that is
also its district. The social images are the hero's photographs — every
approved portfolio photograph, else the cover — with the same alt text; with
none, `pageMetadata` falls back to the brand card.

### `fallback={{ src: STANDARD_DEALER_COVER_PATH, alt: DEALER_PAGE_TEXT.heroFallbackAlt(…) }}`

**R118.** A dealership with no approved photograph used to show a grey frame
with the words "Dealership photograph" in it, which read as a broken page. It
now shows `STANDARD_DEALER_COVER_PATH` (`/brand/dealer-directory-cover.svg`): an
original, neutral Dealers-Drive illustration of a showroom and forecourt — the
same single asset every directory card shows (#289), so a dealership without
photographs looks the same on its card and on its page — in the frame the photographs would
fill, tagged `Dealership photographs coming soon`. The same illustration
appears when every approved photograph fails to load. The moment a photograph
is approved the API returns it and the page shows it instead — nothing here
has to be switched over.

It is an illustration, not the dealership's yard, so it is never passed off as
one: the alt text says it is an illustration shown until the dealership
publishes photographs, the tag says they are coming, it does not open the
viewer, and it is not in `heroPhotos` — so the JSON-LD `image` and the social
images stay empty rather than sharing a picture of somebody else's showroom
as this dealership's.

It is an SVG with the wordmark already converted to outlines, so it renders
the same with or without Manrope, scales to any width without a second
asset, and weighs 14 KB. Its key content sits in the centre so that the
440px banner (cropped top and bottom) and the 16:9 phone frame (cropped at the
sides) both keep the building, the sign and the cars.

### `coverAlt` · `photoAlt`

Was `alt=""`. On the directory card the photograph is decoration beside a link
that names the dealership; here it is the page's own picture of the yard, and
the only description of it an image search has.
