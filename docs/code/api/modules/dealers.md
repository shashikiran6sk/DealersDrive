# api / modules/dealers

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/dealers/dealer-storage-keys.ts`

### `export function dealerRoot(dealerSlug: string): string`

Where a dealership's files live, in one place.

## One folder per dealership, named after the dealership

Everything a dealership owns sits under `dealers/{slug}/` — the KYC scans
under `documents/`, the yard photograph under `yard/`. It used to be two
unrelated trees keyed on the UUID: `kyc/{dealerId}/…` and
`dealers/{dealerId}/yard/…`. That split cost something real every time
somebody opened the bucket, because the two halves of one dealership's
upload sat in two places and neither was labelled with a name a person could
recognise. `dealers/sri-lakshmi-motors-katpadi-vellore-tamil-nadu/` is.

The prefixes still separate the private from the eventually-public — nothing
serves `documents/`, and `yard/` is what fronts the portfolio — but they are
now two prefixes inside one folder rather than two roots.

## The key is derived, and the slug is what it is derived from

For a KYC document the key is not stored anywhere: the last segment is the
_row's_ id, so replacing a document, deleting one, or purging a whole
application all rebuild the same string from the same parts. Three modules
were building it by hand before this file existed, and a template literal
copied into three files is a retention bug waiting for one of them to change.

The consequence is that **a dealership's slug may not change without moving
its objects in the same pass.** No write path changes one (see `dealerSlug`
in the contracts package); `apps/api/scripts/relocate-dealer-storage.ts` is
the one thing that does, and it moves the bytes.

### `export function documentKey(dealerSlug: string, type: DealerDocType, documentId: string): string`

A private KYC scan. There is no route that serves this prefix.

### `export function yardPhotoKey(dealerSlug: string, mediaId: string): string`

The photograph destined to be the public face of the dealership.

## `apps/api/src/modules/dealers/dealers.docs.ts`

### `export const dealersDocs: ModuleDocs =`

C1–C5 and C18. The dealership's own record and its console.

── Reconstruction slice ────────────────────────────────────────────────────
The baseline module documents nine operations. This file grows with the
router beside it — an operation lands in the same PR that mounts its route,
which is what `tests/unit/docs/openapi.test.ts` checks in both directions.
F040 brought the checklist, F041 five more, F043 the completeness read,
**F042 the submit** and **F048 `getDealerDashboard`**, which is the last of
them. Every operation the baseline documents here is now present.
────────────────────────────────────────────────────────────────────────────

## `apps/api/src/modules/dealers/dealers.facade.ts`

### `export type { DealersRepository, DealerWithRelations } from './dealers.repository.js'`

`dealers` as other modules see it (ARCHITECTURE §5.5 rule 3).

Repository types only. Four modules need to read a dealership — vehicles to
check it is active before publishing, billing to price an order, enquiries to
route a lead, search to render the card — and all four do it through the same
scoped repository rather than reaching for prisma themselves.

### `export type { DealersPublicService } from './dealers.public.service.js'`

The buyer-facing service, as a type. `routes.ts` mounts its router and the
container constructs it; nothing else in the codebase needs to know it
exists. It is here rather than imported directly for the same reason
`DealersService` is — one door into this module.

### `export type { DealersService } from './dealers.service.js'`

One consumer, and only for `session()`: the auth module composes the session
body it returns from `/v1/auth/me` out of the dealership half this service
renders. It is a type-only export, so nothing is constructed across the
boundary — the container still does the wiring.

### `export { documentKey, yardPhotoKey } from './dealer-storage-keys.js'`

Where a dealership's private files live.

The admin module needs it for two things the dealer module has no reason to
do: signing a KYC document for a reviewer to read, and emptying the bucket
when an application is rejected. The key is _derived_ — its last segment is
the document row's id — so a copy of the template in the console would be a
second definition of where a scan of somebody's PAN card is stored, and the
day they disagreed the purge would silently leave files behind.

## `apps/api/src/modules/dealers/dealers.public.docs.ts`

### `export const dealersPublicDocs: ModuleDocs =`

A8–A9. The dealer directory, and one dealership's public page.

A separate module from `dealers.docs.ts` because it is a separate _audience_.
The tag a reader browses is "who is this for", not "which file is it in", and
these two operations answer to nobody: no session, no principal, no dealer's
own record. Folding them into `Dealer account` would put an unauthenticated
directory under a heading whose whole description is about the acting
dealership.

── Reconstruction slice ────────────────────────────────────────────────────
The baseline documented these under the search module's tag, because that is
where the routes were mounted. The search module arrives at **F076**, and its
operations are the vehicle ones; these two stay here, beside the service that
answers them.
────────────────────────────────────────────────────────────────────────────

## `apps/api/src/modules/dealers/dealers.public.routes.ts`

### `const ROUTES: PublicDealersRoute[] = [getDealers, getSearchDealers, getLocations, getDealer]`

A8–A9. Public, IP rate-limited, CDN-cacheable. Mounted under `/v1`.

`validate({ query: DealerDirectoryQuery })` is doing real work here: the
schema is `.strict()`, so `/v1/dealers?town=vellore` is a 400 that _names_
`town` rather than a silently unfiltered page of every dealership on the
platform (ARCHITECTURE §9.2).

── Reconstruction slice ────────────────────────────────────────────────────
The baseline mounted these two paths inside `search.routes.ts`, alongside
`/v1/vehicles`, and handed that router a `DealersPublicService` to call. The
search module does not exist yet — it arrives at **F076** — and these two
routes touch nothing it owns: they call `dealersPublic` and nothing else.

So they live in the module whose service answers them. F076 has no reason to
take them back, and if it did the mount point would stay `/v1/dealers`
either way.
────────────────────────────────────────────────────────────────────────────

## `apps/api/src/modules/dealers/dealers.public.service.ts`

### `export interface DealerInventoryStat`

One dealership's live inventory, as the directory needs to count it.

── Reconstruction slice ────────────────────────────────────────────────────
The baseline read this straight off `search.dealerStats()`, which groups
`listing_search` — the read model **F064** creates and **F076** queries.
Neither exists yet, so this feature declares the shape it needs and takes it
as a dependency rather than reaching for a module that is not there.

`noInventoryYet` below is the implementation until F076: no listings exist,
so every dealership genuinely has none, and the honest answer is zero. The
directory already renders that case — a dealership with no live cars appears
with an em dash rather than being hidden (A8) — so nothing here is a
placeholder waiting to be redesigned. F076 replaces one function.
────────────────────────────────────────────────────────────────────────────

### `export const noInventoryYet: DealerInventoryStats =`

No listings exist before F064. Zero is the truth, not a stub.

### `const CARD_COVER_WIDTH = 640`

The widths the two public surfaces ask for.

`DirectoryCard`'s cover is a 104px band across a ~290px card, so 640 is one
retina step above what it needs and the smallest rendition that does not
soften on a phone. The portfolio's is a 170px band across the full 1280px
column, which is the one place a yard photograph is looked _at_ rather than
glanced past.

### `export function createDealersPublicService({ repo, stats }: DealersPublicDeps)`

A8–A9. Nothing here returns a phone number; A7 is the only route that can.

### `async directory(query: DealerDirectoryQuery): Promise<DealerDirectoryResponse>`

A8 — the grid, its city chips and its count.

Filtering, searching and paging happen in this process rather than in the
query, which is the baseline's shape and is deliberate at this size: the
directory is every ACTIVE dealership on the platform, the city chips need
a count over the _unfiltered_ set, and one ordered read serves all three.
The day that stops being true is the day the chips need their own query,
not the day this gets a `WHERE` clause bolted onto it.

### `const inDistrict =`

The district first: it is the wider filter, and the city chips are

### `const inDistrict =`

counted over what it leaves.

### `const covers = await repo.readyMediaIds`

Asked for the page, not for the directory: 24 ids rather than every

### `const covers = await repo.readyMediaIds`

ACTIVE dealership's, and one query rather than one per card.

### `services: distinctServices(dealer.specialities).slice(0, 3)`

Collapsed on the way out as well as on the way in (**R18**). The
write path is where a duplicate stops being created; this is what
covers the rows that already hold one, because nothing backfills
the column and a card that shows "Finance" twice reads as a fault
of the page rather than of the data. Collapse before the slice, so
a dealership whose first four entries are three distinct services
still gets three chips.

### `fromPriceLabel: fromPrice === null ? '—' : `from ${formatLakh(fromPrice)}``

A dealer with zero live cars still appears, with an em dash (A8).

### `logoUrl: null`

No logo yet: nothing in the product writes `logoMediaId`, so there
is no image to address. `DirectoryCard` renders the initials tile,
which is the design's answer for a dealership without one rather
than a gap waiting on a feature.

### `coverUrl:`

The yard photograph, addressed by media id and width — never by
storage key, so this URL survives the bucket being reorganised
(`platform/media/urls.ts`).

Null unless the row is READY. A `coverMediaId` pointing at a
PENDING or ORPHAN upload would render as a broken image, and the
`ImageSlot` it replaces is the more honest answer.

### `cities: chipsOf(inDistrict, cityChip)`

The chips, over the **district** and not over the page — so choosing
one cannot empty the row it was chosen from, and a district's towns
stay visible while its dealerships are being filtered by name.

Narrowed by the district and by nothing else. Narrowing them by the
cities already chosen would delete the chips a buyer needs in order
to change their mind.

### `districts: chipsOf(dealers, districtChip)`

The districts, over every ACTIVE dealership. Never narrowed: this is
what the header offers, and a selector that dropped the options you
did not pick is one you cannot get back out of.

### `async suggest(query: DealerSuggestQuery): Promise<DealerSuggestResponse>`

A8b — the dealer typeahead (**R43**).

The same `listActive()` read the directory makes, matched differently and
cut to six rows. It is deliberately _not_ `directory()` with a small
`limit`: that composes a cover URL per row (a second query), a price
string, a service list and two chip tallies over the whole platform —
all of it thrown away by a dropdown, and all of it recomputed on every
debounced keystroke.

## Why the match is wider than the grid's

`directory()` filters on the trading name alone. This also matches the
town and the district, because the box is a **suggest** and the two
answer different questions: the grid is showing what a buyer asked for,
and the dropdown is offering what they might have meant. Somebody typing
"katpadi" has named a place, and the useful answer is the four yards in
it rather than nothing at all.

`matchedOn` travels with the row so the dropdown can mark the characters
that put it there — see `DealerSuggestion`.

## Ordering

Rank first, then inventory, then the name. The rank is the point: a
dealership _called_ "Vellore Cars" is a better answer to "vel" than one
that merely trades in Vellore, and a prefix is a better answer than a
substring — "Sri" should offer Sri Lakshmi Motors before Kumaresan Sri
Motors. Ties break on cars in the yard and then alphabetically, so the
list does not reshuffle itself between two identical requests.

### `const cities = citySlugsIn(query.city)`

Narrowed by the page's own filters before anything is matched. The box
sits inside a filtered directory, and a row that vanishes when it is
chosen — because the grid behind it is still filtered by district — is
worse than no row at all.

### `const total = ranked.length`

The count is over everything that matched, not over the six returned —
"4 matching yards" above four rows and "18 matching yards" above six
are both true, and the second is the one that tells a buyer to keep
typing rather than to conclude the platform has six dealerships.

### `search: query.search`

Echoed back so the client can drop an answer that arrived late. See

### `search: query.search`

`DealerSuggestResponse`.

### `async locations(): Promise<PublicLocations>`

A12 — the districts the platform trades in, for the header's selector.

Its own read rather than a slice of the directory's, because the header
is in the public layout: it renders on the home page and on the
catalogue, neither of which has any reason to fetch a page of
dealerships.

### `async profile(slug: string): Promise<DealerPublicProfile>`

A9 — the dealership's own page. `findPublicBySlug` refuses anything but ACTIVE.

### `tagline: dealer.tagline`

The one line under the name (**R25**). `dealer.about` is deliberately

### `tagline: dealer.tagline`

not here: nothing public reads it any more, and a field that leaves

### `tagline: dealer.tagline`

the API is a field that has to be kept true.

### `services: distinctServices(dealer.specialities)`

As on the card, and for the same reason (**R18**) — the portfolio

### `services: distinctServices(dealer.specialities)`

renders one tag per service and keys it by the string.

### `mapsUrl: directionsUrl(dealer.mapsUrl, dealer.lat, dealer.lng)`

R6, with the one exception `directionsUrl` explains.

### `geo:`

The pin the link resolved to, when it resolved to one. Both halves

### `geo:`

have to be present: a row with a latitude and no longitude is not a

### `geo:`

place, and centring a map on half a coordinate puts it in the sea.

### `embedUrl: embedUrlFor(`

The map the card draws, composed from whatever the dealer's link
turned out to carry — the place card when it named a place, the
plain pin when it only placed one, null when it did neither.

Composed here rather than in the card because the choice between
those three is a question about the stored link, and the card
would have to re-parse the link to ask it. `embedUrlFor` is in
`platform/maps` with the rest of the Maps URL grammar.

### `{ key: 'city', label: 'City', value: [city, state].filter(Boolean).join(', ') }`

No phone row at all (**R16**). It said "Tap to reveal" and carried
no digits, which was safe — but nothing on this page can act on it:
A7 is vehicle-scoped, so the button that would reveal a number
belongs to a listing and not to a dealership. An invitation with
nothing behind it reads as a control a buyer failed to find.

Rule 7 is unchanged and, if anything, easier to hold: there is now
no phone-shaped row in this payload at all.

### `...(dealer.gstin`

GSTIN is public — it is on every Indian invoice. PAN never is.

### `logoUrl: null`

As above: no logo is written anywhere yet, and the cover is a URL only

### `logoUrl: null`

once its bytes are actually servable.

### `isIndexable: carCount > 0`

Indexable only if ACTIVE and holding at least one live listing

### `isIndexable: carCount > 0`

(§17.2). Every dealership is therefore noindex until F064 — which

### `isIndexable: carCount > 0`

is right: a portfolio with nothing in it is a page Google should

### `isIndexable: carCount > 0`

not be sent to, and this is the condition that says so.

### `function directionsUrl`

What "Get directions" should actually open.

**R6 stores the dealer's link verbatim and this returns it verbatim**, with
one exception: an _embed_ URL. `google.com/maps/embed?pb=…` is the src of the
iframe Google's Share → Embed panel hands out, and dealers paste it because
it is what a "put a map on your site" tutorial tells them to copy. It draws a
perfectly good map — the pin is in the `pb` blob — but opened as a link it is
a bare embedded map with no place card and no directions.

So when that is what was pasted, the button is built from **the dealership's
own pin**, which is the same pin that URL contains. This is not the thing R6
forbids: the prohibition is on composing a destination out of a _typed
address_, because an address is several gates in one district. These
coordinates came from the dealer's own link.

No pin, or any other kind of link: verbatim, as before.

### `return mapsUrl`

A row written before the URL was validated. Not this function's problem.

### `function citySlugsIn(value: string | undefined): Set<string>`

`?city=vellore,katpadi` — the chips a buyer has toggled on.

`all` is accepted as "no filter" rather than as a town, because that is what
the baseline's single-select chip sent when it was cleared and a link that
still says it should not return an empty page.

### `function chipsOf<T, C extends LocationChip>(rows: readonly T[], chip: (row: T) => C | null): C[]`

Counts one place per dealership, busiest first, dropping the rows that never
answered the question.

One function for the city chips and the district selector because they are
the same computation over a different column — and they were the same
fourteen lines twice before this, which is how the two come to disagree about
whether an unnamed locality is a chip.

`chip` returns the row the place _would_ contribute, or `null` when the row
never named one. Generic in the chip rather than in the tuple so the district
list can carry its state (**R22**) through the same counting, ordering and
dropping rules as the towns, instead of a second copy of them.

### `return [...chips.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))`

Busiest first, then alphabetically — otherwise two districts of the same

### `return [...chips.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))`

size swap places between requests and the row appears to shuffle itself.

### `function cityChip(row: { citySlug: string | null; cityName: string | null }): LocationChip | null`

A town chip, or `null` for a dealership that never named its town.

### `function districtChip(row:`

A district chip, carrying the state it is in (**R22**) — which is what lets
the header group `Vellore` under `Tamil Nadu` without working the pairing out
for itself.

The state is whatever the **first** dealership counted into the chip typed,
and it is null when that dealership left the field blank. Neither case drops
the district: the selector's list is the platform's coverage, and a district
that vanished because somebody skipped a form field is a place a buyer can no
longer reach.

### `function locationLabel(city: string, state: string, years: number): string`

"Vellore, Tamil Nadu · 7 years", and gracefully less when a dealership
predates one of the fields. The baseline built this inline and produced
", Tamil Nadu · 1 years" for a row with no city — a string a buyer sees.

### `function responseLabel(medianMins: number | null): string`

A dealer who never touches their inbox degrades their own public stat.
That feedback loop is intentional (§14.3).

### `interface SuggestHit`

Why a row is in the dropdown, and how strongly.

Lower ranks sort first. The ladder is deliberately coarse — a name prefix, a
name, then a place — because it is answering "which of these did they mean",
and a finer score over six rows is a tie-break nobody can perceive.

### `function matchDealer`

The one place that decides whether a dealership answers what was typed.

**The name is tried before the place, and the best hit wins**, so a
dealership called "Vellore Cars" in Vellore is a name match rather than a
town match — which is what `matchedOn` then tells the dropdown to underline.

A word-boundary hit outranks a bare substring: "sri" should offer Sri Lakshmi
Motors above Kumaresan Sri Motors, and both above a dealership that merely
has the letters somewhere inside a word.

### `if (dealer.cityName?.toLowerCase().includes(needle))`

The place, and the town before the district: a town is the narrower claim,

### `if (dealer.cityName?.toLowerCase().includes(needle))`

so it is the more specific reason to have offered the row.

### `function startsAWord(haystack: string, needle: string): boolean`

Does the needle start any word of the haystack — "sri" in "Lakshmi Sri Motors".

### `if (/[^a-z0-9]/.test(haystack[at - 1] ?? '')) return true`

A separator, rather than `\s`, so "R.K. Motors" matched on "motors" and a

### `if (/[^a-z0-9]/.test(haystack[at - 1] ?? '')) return true`

hyphenated name both count as word starts.

### `function suggestMeta`

"42 cars in yard · Katpadi, Vellore" — the one line under a suggestion.

**A dealership with no live cars gets the place and nothing else**, rather
than "0 cars in yard". That is the same call the directory card makes with
its em dash (A8), and it matters more here: until **F076** every dealership
on the platform has zero, so a naive label would render six identical zeroes
over a dropdown and read as a broken endpoint rather than an empty catalogue.

The town and the district collapse when they are the same word, which in
Indian district naming they very often are — "Vellore, Vellore" is not a
place anybody writes.

## `apps/api/src/modules/dealers/dealers.repository.ts`

### `profileEdits: { orderBy: { createdAt: 'desc' as const }, take: 1 }`

The newest edit this dealership has proposed to its own public words, and
only the newest (**R34**).

`take: 1` because the profile screen asks one question — _"is there
anything to tell this dealer about their last save"_ — and the answer is
always about the most recent request. Older rows are the dealership's
publishing history; nothing renders them, and pulling them all would grow
this include without bound on the busiest dealerships.

In the include rather than in a second query so that every path holding a
`DealerWithRelations` can answer it. `toProfile` is called from five places
and one of them forgetting to look would be a dealer told nothing about a
refusal.

### `function placeSlug(value: string | null): string | null`

A locality's slug, or null when there is no locality.

Truthiness rather than `=== null`, and the difference is not pedantry: a
column can hold `''` — `normaliseLocality` maps a field of spaces to it — and
`slugify('')` is an empty slug, which is a filter value that matches
everything and displays as nothing. Both mean "not answered", and both have
to reach the response as null so the chip is dropped rather than rendered
blank.

### `async findPublicBySlug(slug: string): Promise<DealerWithRelations | null>`

Only ACTIVE dealers are ever public — the directory included (§11.1).

### `async slugById(dealerId: string): Promise<string | null>`

The dealership's slug, and nothing else.

Every storage key a dealership owns is derived from it
(`dealer-storage-keys.ts`), and the three KYC write paths need it without
needing anything else about the dealership — so they ask for one column
rather than pulling `dealerInclude`'s documents and members across to
read a string off the row.

### `cityName: dealer.city`

`citySlug` went with the `cities` table. The directory's filter is

### `cityName: dealer.city`

derived from the name the dealership carries, so a link stays stable

### `cityName: dealer.city`

as long as the dealership does not move — which is the same promise

### `cityName: dealer.city`

the slug made, without a table to keep in step with it.

### `districtName: dealer.district`

The area a buyer would drive across, as opposed to the town they

### `districtName: dealer.district`

would name. Both are derived from the dealership's own text, so

### `districtName: dealer.district`

neither can drift from a lookup table that no longer exists (D6).

### `coverMediaId: dealer.coverMediaId`

The yard photograph, as an id. The directory turns it into a URL only

### `coverMediaId: dealer.coverMediaId`

for the page it is rendering, and only for the rows whose media is

### `coverMediaId: dealer.coverMediaId`

actually servable — see `readyMediaIds` below.

### `async documentByType`

The row currently occupying a slot, whatever state it is in.

Both write paths need it for the same reason: the stored object's key
ends in the row's id, so replacing or removing a document means knowing
which id is being displaced before it is overwritten.

### `async findConflicting`

One dealership carrying this name **in this city**, or this GSTIN or PAN
anywhere — ignoring the one asking.

The three unique indexes are the real guarantee; this read is what turns
a collision into a message against the field the dealer just typed. Every
comparison is case-insensitive, because "Sri Lakshmi Motors" and "SRI
LAKSHMI MOTORS" in one town are one business applying twice and a
case-sensitive index would let the second one through.

The name clause carries the city with it. A name on its own says nothing
— three families in three towns trade as "Sri Balaji Motors" — so a name
asked about without a city cannot conflict, and this returns false for
it rather than guessing at the dealership's current one. Callers that
mean "does this name still fit where I am" pass both.

**One query, however many fields are asked about.** A dealer filling in
step 3 sends GSTIN and PAN together, and two round trips to answer one
question is a round trip nobody needed — the clauses are OR'd and the
three answers are read back off the same rows (**R38**).

### `gstin: gstin !== undefined && rows.some((row) => lower(row.gstin) === gstin)`

The `!== undefined` guards are belt and braces rather than a fix:

### `gstin: gstin !== undefined && rows.some((row) => lower(row.gstin) === gstin)`

`lower()` returns `string | null` and never `undefined`, so an

### `gstin: gstin !== undefined && rows.some((row) => lower(row.gstin) === gstin)`

unasked-about field could not have matched anyway. They are here so

### `gstin: gstin !== undefined && rows.some((row) => lower(row.gstin) === gstin)`

the intent — _a field nobody asked about cannot clash_ — is stated

### `gstin: gstin !== undefined && rows.some((row) => lower(row.gstin) === gstin)`

rather than inferred from a type two lines away.

### `async readyMediaIds(mediaIds: string[]): Promise<Set<string>>`

Which of these uploads can actually be served.

`media.serve()` answers only for a READY row, so a `coverMediaId`
pointing at anything else must not become a URL on a public page — the
card would render a broken image where the honest answer is the
`ImageSlot`. One query for the whole directory page rather than one per
card.

### `async markMediaReady(mediaId: string)`

The one promotion this module performs, on commit of a yard photograph.

Vehicle photos are promoted by F034's worker after it re-encodes them.
This one has nothing to re-encode yet and is the dealership's own
deliberate act, so it is READY the moment its bytes are confirmed.

### `async orphanMedia(mediaId: string)`

ORPHAN rather than a delete. The row is the only record that the bytes
ever existed; a sweeper reconciles orphaned rows against storage, and a
row deleted the instant its object is removed leaves nothing to reconcile
against if the storage call is the half that fails.

### `async newEnquiryCount(_dealerId: string): Promise<number>`

── Reconstruction slice ──────────────────────────────────────────────
The baseline body is
`prisma.enquiry.count({ where: { dealerId, status: 'NEW' } })`
and the `Enquiry` model arrives at **F088**. With no enquiries table
there are no enquiries, so zero is the answer rather than a placeholder
— but it is not the baseline's code, and the query is restored with the
model. `pendingListingCount` is the same story against **F064**.

### `async viewRollups`

── C18, the dashboard's six reads (F048) ─────────────────────────────

Every one of them queries a model that does not exist yet:
`ListingViewDaily` and `Listing` at **F064**, `Enquiry` at **F088**,
`CreditTransaction` at **F050**. So each returns the answer that is true
with no rows — an empty result or a zero — with the baseline's query in
the comment above it.

**They are on the repository rather than inlined in the service, and
that is the whole point of doing it this way.** `dashboard()` keeps the
baseline's derivation intact and verbatim — the greeting, the seven-day
series, the height scaling, the four delta sentences — because that is
the code a reviewer has to check against the baseline and the code a
later feature must not re-invent. What is held back is six queries, each
one line, each named. A service that computed zeros inline would hide the
derivation behind the slice, and restoring the models would then mean
rewriting the part that was never in question.

Each of these is restored by the feature named against it, and F048's
entry in the feature map lists them.

### `async viewRollups`

Daily view rollups for this dealership since `from`.

Baseline:

```ts
prisma.listingViewDaily.groupBy({
  by: ['day'],
  where: { dealerId, day: { gte: from } },
  _sum: { views: true },
});
```

`ListingViewDaily` arrives at **F064**.

### `async previousWeekViews(_dealerId: string, _from: Date): Promise<number | null>`

Views in the week before `from`, or null when that week has no rows at
all.

**Null and zero are different answers and the dashboard renders them
differently**: null is "no data for last week", zero is a real week with
no traffic, and reporting the first as the second fabricates a −100%
trend. Prisma's `_sum` is null for an empty aggregate, which is exactly
the distinction wanted, so the shape is kept rather than flattened.

Baseline:

```ts
(
  await prisma.listingViewDaily.aggregate({
    where: { dealerId, day: { gte: previousWeekStart, lt: from } },
    _sum: { views: true },
  })
)._sum.views;
```

`ListingViewDaily` arrives at **F064**.

### `async enquiryCounts`

NEW enquiries since `from`, and every non-SPAM enquiry in the week
before it — the pair the "vs last week" sentence is built from.

One method for two counts because they are only ever wanted together and
must be measured against one clock.

Baseline: two `prisma.enquiry.count` calls. `Enquiry` arrives at
**F088**.

### `async recentEnquiries(_dealerId: string, _limit: number): Promise<RecentEnquiryRow[]>`

The newest enquiries, for the console's right-hand panel.

Baseline: `enquiries.recentForDealer(dealerId, limit)` — a facade call
into the enquiries module, which arrives at **F088** and brings the
`EnquiriesService` dependency with it.

### `async expiringListingCount(_dealerId: string, _horizon: Date): Promise<number>`

Approved listings expiring inside seven days — the dashboard's one
alert.

Baseline:

```ts
prisma.listing.count({
  where: { dealerId, status: 'APPROVED', expiresAt: { lte: horizon } },
});
```

`Listing` arrives at **F064**.

### `async weeklyActivity`

Credits spent on listing submissions this calendar month, and listings
approved since `from` — the two "delta" numbers under the stat cards.

Baseline: a `prisma.creditTransaction.count` on `reason: 'HOLD_SUBMIT'`
and a `prisma.listing.count` on `approvedAt`. `CreditTransaction`
arrives at **F050** and `Listing` at **F064**.

### `export interface RecentEnquiryRow`

One enquiry as the dashboard panel needs it (**F048**).

Declared here rather than inferred from a Prisma payload because the model it
will be inferred _from_ does not exist yet. When `Enquiry` lands at F088 this
becomes a `Prisma.EnquiryGetPayload<…>` and the shape below is what that
payload has to satisfy — which is the useful half of writing it out: the
fields the console actually reads are recorded, rather than "whatever the
include happened to select".

`vehicle` is null for a general enquiry — somebody asking the dealership a
question rather than asking about one car — and the panel renders that as
"General enquiry" rather than dropping the row.

## `apps/api/src/modules/dealers/dealers.routes.ts`

### `const ROUTES: DealersRoute[] = [`

C1–C5 and C18. Mounted under `/v1/dealer`.

The line this router draws is between _reading_ your dealership and _changing_
it. Reads are open to any seat that got through `requireDealer` — a
salesperson can see the dashboard. Writes are OWNER-only, because the profile
and the KYC documents are the dealership's identity.

── Reconstruction slice ────────────────────────────────────────────────────
F040 mounted the document checklist, F041 five more, F043 the completeness
read, **F042 the submit** and **F048 `GET /dashboard`**, which closes the
module. Every route the baseline declares here is now mounted.
────────────────────────────────────────────────────────────────────────────

## `apps/api/src/modules/dealers/dealers.service.ts`

### `export interface DealersDeps`

── Reconstruction slice ────────────────────────────────────────────────────
The baseline file is 610 lines and covers the profile, the onboarding
completeness tracker, the KYC document paths and the dealer dashboard. Each
of those belongs to a feature further down the list, and each brings a
dependency this one does not have: `StoragePort` for the document
presigning, `EnquiriesRepository` for the dashboard, `Vehicle` and `Listing`
for the counters.

`session()` landed with **F018** — the one method the auth module calls, and
the reason `dealers.facade.ts` re-exports `DealersService` at all.
`documents()` landed with **F040**. **F041** adds `toProfile`/`profile`,
`update`, and the three document write paths, and with them the first
dependency this service takes beyond its repository: `StoragePort`.

F043 added `completeness()` and **F042** `submitForVerification()`, which
closes onboarding: every method the dealer-facing wizard calls is now here.
Still to come: `dashboard()` with **F048**, which brings
`EnquiriesRepository` and the `Listing` counters.
────────────────────────────────────────────────────────────────────────────

### `maps: MapsPort`

Where the yard is, out of the dealer's own Maps link. Best-effort.

### `audit: AuditService`

R34. The dealer's own submission of a profile edit is audited, not only
the moderator's decision on it — "who typed this" is the first question
asked about a phone number that reached a public page, and a trail that
records only the approval cannot answer it.

This is the first thing in this service to need the audit port, and it is
the right first thing: every other write here is a dealer editing fields
that are theirs outright.

### `const DOC_TYPES: DealerDocType[] = ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF']`

The closed set. Three documents, always, in this order — the checklist is
fixed rather than data-driven, because "which documents does KYC need" is a
regulatory answer and not a per-dealer one.

### `const YARD_PHOTO_URL_TTL_SECONDS = 300`

How long a yard-photo read URL is good for.

The same five minutes a KYC document gets. The image is destined to be
public, but it is not public _yet_ — a dealership in DRAFT has not been
looked at by anybody, and until it has, its photographs are as private as
the rest of the application.

### `function sameServices(a: readonly string[], b: readonly string[]): boolean`

Whether two service lists say the same thing (**R34**).

Order-insensitive and after `distinctServices`, because neither the order a
dealer typed their services in nor a repeat they typed twice is a change
anybody should be asked to approve. Without this, re-saving the profile
screen without touching the box would put a request in front of a moderator
asking them to agree that nothing had happened — the box is one
comma-separated line, so a dealer editing their tagline re-submits the
services every time.

A `Set` on both sides rather than a sorted join: the values are already
de-duplicated, so equal sizes plus containment is the whole of it.

### `mapKind: mapKindFor(`

What that link draws (**R20**). Composed here rather than in the form
for the reason `embedUrl` is composed for the portfolio: which of the
three answers a link produces is a question about the stored value,
and the form would have to re-parse the URL to ask it — in a second
implementation, in another package, that could disagree.

### `function toProfileChange`

The newest proposed edit, if it still has something to say (**R34**).

`null` for an APPROVED one, and that is the interesting case. Its values
are the ones on the profile beside it — the approval wrote them — so a
banner reporting it would be telling a dealer that the line they can see is
the line they asked for. The two states worth a word are PENDING, which
explains why the page still shows the old text, and REJECTED, which is the
only place a dealer ever learns why.

### `async function requireSlug(dealerId: string): Promise<string>`

The dealership's storage identity.

Every object a dealership owns lives under `dealers/{slug}/`, and the key
of a KYC document is derived rather than stored — so each of the three
document paths has to know the slug before it can name a file. One narrow
read, rather than `requireDealer`'s full include, because the slug is the
only thing any of them wants.

### `async function assertNoDuplicate`

Two dealerships in one city must not share a registered name, and no two
anywhere may share a GSTIN or a PAN.

The unique indexes on `(legalName, city)`, `gstin` and `pan` are what
actually guarantee it, and they are what makes this safe against two
applications racing. This read exists for the other half of the job:
turning a collision into a message against the field the dealer just
typed, rather than a Prisma P2002 the error handler renders as a 500.

The name is always asked about together with a city — the one being moved
to, or the one the dealership is already in — because a name on its own
cannot be a duplicate of anything.

**PAN joined GSTIN at R38.** The asymmetry before it was not a decision:
both are read off a document by the same moderator on the same screen, and
both identify one taxable entity. Two dealerships holding one PAN is
either one business applying twice or a typo that has carried somebody
else's tax identity into a KYC review.

### `if (clash.legalName)`

`clash.legalName` is only ever true when both were asked about, so the

### `if (clash.legalName)`

message can name them without a fallback that would never be reached.

### `if (clash.pan)`

GSTIN first, then PAN, when a step-3 submit carries both and both clash.
One field error at a time is the shape every other check on this path
uses, and GSTIN is the more specific of the two — a GSTIN embeds the PAN
of the entity that holds it, so a dealer who fixes the GSTIN usually
fixes the PAN with it. Reporting the derived field first would send them
to the wrong document.

### `async function discardMedia(mediaId: string): Promise<void>`

Remove the bytes, keep the row as ORPHAN so a sweeper can reconcile it.

### `async session(principal: DealerPrincipal): Promise<AuthSession>`

The dealer half of B4. `identity` is filled in by the auth module, which
owns the OAuth tables — this service knows about dealerships, not about
how the person at the keyboard proved who they are.

### `next:`

A dealership still in DRAFT has not finished onboarding, whatever the

### `next:`

client remembers; PENDING_APPROVAL is waiting on a human at our end.

### `phoneVerified: owner?.user.phoneVerifiedAt != null && owner.user.phone === phone`

The _owner's_ verified flag, not the dealership's contact row
(**R39**). `dealers.contactPhone` is the display mirror and is
written from the verified number; if the two have drifted the
honest answer is that this number was not proved.

### `async amendDraft(dealerId: string, input: UpdateDealerInput): Promise<DealerProfile>`

C2. Partial, so a wizard `Back` never loses data.

`contact.phone` is patchable now, and the change is smaller than it
sounds: the number stopped being a credential when dealers started
signing in with Google, so what is being edited is the contact detail a
buyer is given. It is still unique across users — the check below is the
message; `users.phone`'s unique index is the guarantee.

### `async amendDraft(dealerId: string, input: UpdateDealerInput): Promise<DealerProfile>`

C2b — the same write, while the dealership is still a DRAFT (**R27**).

`update` above takes `UpdateDealerInput` and always has; what changed in
R27 is who may hand it one. `PATCH /v1/dealer` now validates against
`DealerSelfUpdateInput` — three fields — so the onboarding wizard, which
walks back to the steps that ask for the name and the address, needed a
door of its own.

The guard is the status and nothing else. A DRAFT dealership is one still
answering these questions, or one a moderator has sent back to fix an
answer: `Request changes` writes `status: 'DRAFT'` with a reason, which is
what makes this the same door in both cases. Nothing has been verified
about a DRAFT, so there is nothing an edit here can invalidate.

`PROFILE_LOCKED` rather than a 403: the seat is allowed to write — it
holds `dealer:update` and it just wrote the tagline — and what is refused
is the _state_, which is what a 409 says. A dealer never sees this
message; the profile screen does not offer the boxes and the wizard is
only reachable while DRAFT. It is here for the client that goes looking.

### `async selfUpdate`

C2 — the dealership editing itself, after onboarding is over, with the
two public sentences held for review (**R34**).

## Why this is not just `update`

Three fields reach this method and they do not all mean the same thing.
`establishedYear` is a fact bounded by 1900 and the current year:
there is no way to write a phone number, a rival's name or a WhatsApp
handle into an integer, so it is published the moment the dealer saves
it. The tagline and the service list are the only prose a dealer writes
that a buyer reads — which makes them the only place a number can reach
a public page without passing `POST /v1/vehicles/:id/reveal-contact`, the
one route allowed to hand one out, rate-limited twice over and logged as
a lead (rule 7).

Every other field on the profile screen has been read-only since **R27**
for the same family of reasons. These two were left editable because a
dealership is genuinely entitled to revise how it describes itself, and
both facts are true at once. A queue is what reconciles them: the dealer
keeps the pen, and nothing they write is public until somebody has read
it.

## What a DRAFT skips, and why that is not a hole

A dealership that is not ACTIVE writes straight through. Nothing about it
is public — the directory and the portfolio both require
`status === 'ACTIVE'` (rule 6) — so there is no page for a phone number
to appear on, and the whole application is read by a moderator at
approval anyway. Queueing an edit to an invisible field would put a
dealership in the odd position of waiting for permission to finish an
application nobody has started reviewing.

## One request at a time, and the boxes are shut while it waits

A dealership has at most one proposal outstanding, and a second edit to
either sentence while one is waiting is a **409** rather than a merge.
The profile screen does not offer the boxes at all in that state — they
are `disabled` and show the proposed text — so this refusal is the
server-side half of a rule the form already states, in the same shape
R27 used for the locked fields: the form is why a dealer never sends
one, and this is why it would not be written if they did.

Merging them instead was the first design and it was worse in a way that
only shows up from the moderator's side. A request that quietly absorbs
later edits is a request whose text can change _after_ somebody has
started reading it — the queue row a moderator opened and the row they
approve are then not the same words, and nothing tells them so.

## Withdrawing is a button, not a coincidence

`withdrawProfileChange` below deletes the waiting request. There is no
inference from what the dealer typed: an edit that happens to restore the
live value is still an edit, and reading it as a cancellation makes the
cancel path something a dealer has to discover rather than press.

What survives from that idea is much narrower and is not a withdrawal —
`changed()` below asks whether a save _proposes anything at all_. The
form submits all three fields on every save, so a dealer correcting only
their established year re-sends the tagline and the service list
unchanged, and without that check every such save would put a request in
front of a moderator asking them to approve the status quo.

### `if (input.establishedYear !== undefined)`

The year is a fact, not a sentence, so it goes straight in. Doing it

### `if (input.establishedYear !== undefined)`

first means a save carrying all three fields still lands the half that

### `if (input.establishedYear !== undefined)`

needs no review, rather than making the year wait behind the prose.

### `const tagline =`

What this save actually proposes.

`undefined` is a field the save did not carry; a value equal to what is
already live proposes nothing. The second half is not a withdrawal —
see the note above — it is the answer to "is there anything here to
review", asked because the form re-sends all three fields every time.

### `const pending = dealer.profileEdits.find((row) => row.status === 'PENDING')`

One at a time. The boxes are shut on the profile screen while a request
waits, so reaching here means a client went around the form — and a
409 rather than a 403 because the seat is allowed to write and it is
the _state_ that refuses, which is the same reading `amendDraft` gives
`PROFILE_LOCKED`.

### `await audit.record(tx`

The dealer's own submission is audited as well as the decision on it.

Without this the audit trail can say a moderator approved a tagline
and cannot say who wrote it — and "who typed this" is the first
question asked about a phone number that reached a public page.

### `await enqueueOutbox(tx`

**R40.** A queue nobody is told about is a queue nobody works, and
R34 shipped the request without one — a dealership's proposal sat
waiting until a moderator happened to open the console.

In the transaction, like every other outbox write on this path: the
email is then exactly as durable as the request it is about, and a
rollback cannot leave a moderator reading about a change that does
not exist.

### `actor: { type: 'DEALER', ...(actorUserId === null ? {} : { id: actorUserId }) }`

`actorUserId` is nullable on this path — an admin editing on a

### `actor: { type: 'DEALER', ...(actorUserId === null ? {} : { id: actorUserId }) }`

dealer's behalf has no dealer seat — and `actor.id` is optional

### `actor: { type: 'DEALER', ...(actorUserId === null ? {} : { id: actorUserId }) }`

rather than nullable, so the key is dropped instead of nulled.

### `async withdrawProfileChange`

The dealer taking their own proposal back (**R34**).

A button rather than an inference. The first design read "the dealer
retyped the live value" as a cancellation, which made the way out
something to be discovered rather than pressed — and was wrong on its own
terms besides, since an edit that happens to restore the live text is
still an edit.

The row is **deleted**, not marked withdrawn. A record that a dealership
briefly considered a different tagline is not history anybody reads, and
a WITHDRAWN row would sit in the `[dealerId, createdAt]` read this
service makes on every profile render, having to be filtered out
everywhere for the sake of nothing.

Nothing waiting is a 404. The button only renders when there is one, so
reaching this with nothing to cancel is a double-click or a stale page —
both of which want the screen re-read, which is what a 404 gets them.

### `await audit.record(tx`

Audited even though the row is gone: `entityId` outlives it, and

### `await audit.record(tx`

"what happened to the edit I was reviewing" is a question a moderator

### `await audit.record(tx`

will ask about a queue row that vanished under them.

### `const city =`

Locality as text, normalised once here.

A slug resolved against `cities` until the table went; the note on
`UpdateDealerInput.address` in contracts records why. `lat`/`lng` came
off that row and are written again below — out of the dealer's own
Maps link, never out of the typed address.

### `const specialities =`

The services, collapsed to a set (**R18**).

Here rather than in the schema, for the reason the localities are here:
this is a normalisation, not a refusal. A dealer who types "Finance,
finance" has made a slip, and the useful answer is one service rather
than a 400 explaining that they typed a word twice. A transform in the
input schema would also have to survive `z.toJSONSchema`, and a
transform cannot be represented in JSON Schema at all.

The 12-item cap in `UpdateDealerInput` is therefore over what was
_typed_, not over what is kept. Thirteen entries with a duplicate among
them is still a 400 — a rarer accident than the one this fixes, and
moving the cap after the collapse would take `maxItems` out of the
reference.

### `const phone = input.contact?.phone === undefined ? undefined : toE164(input.contact.phone)`

The contact number, in the one form the column stores.

`toE164` runs here rather than at the edge for the same reason
`normaliseLocality` does: the uniqueness constraint is an index over
the stored string, so `98400 12345` and `+919840012345` have to become
one value _before_ anything compares them.

### `const mapsUrl = input.address?.mapsUrl`

The pin, and the place it names, re-read whenever the link changes.

Only when it _changes_: a dealer editing their opening hours should not
pay a request to Google for it, and a link that resolved once resolves
to the same place. `null` when the link cannot be resolved — which
clears a stale pin rather than leaving the previous yard's coordinates
attached to a dealership that has moved.

This is the one place a network call sits on a dealer's save, and it is
bounded and best-effort: `resolveCoordinates` swallows a timeout and
answers null, the "Get directions" anchor is `mapsUrl` either way, and
the location card falls back to the slot it showed before.

### `if (phone !== undefined && owner)`

A changed contact number is a new claim, and claims are proved
elsewhere (**R39**).

This was a uniqueness lookup, and a number nobody else held was
accepted on the strength of having been typed. It is now the same
assertion onboarding makes: the number must already be the one on this
owner's user row, verified — which means the dealer went back to step
1, asked for a code and entered it. `PHONE_ALREADY_REGISTERED` is
raised there instead, at the moment of the claim.

Named as the client sent it, so the form can mark the box the dealer
typed into. `apps/web` maps the leaf to `phone`.

### `const nameCity = city ?? dealer.city ?? undefined`

A rename is checked against the city it will be in once this PATCH
lands, which is not always the city the dealership is in now: a dealer
changing both fields in one submit must be checked against the pair
they typed, not against a half-applied combination of the two.

### `await tx.user.update(`

No `phone` here any more (**R39**). The assertion above has already
established that `users.phone` holds this number; writing it a
second time would make this a second writer of a column with
exactly one — see `auth/verified-phone.ts`.

### `...(input.legalName === undefined`

One name. `brandName` is the display mirror and is written here

### `...(input.legalName === undefined`

rather than accepted from the client, which is why

### `...(input.legalName === undefined`

`UpdateDealerInput` does not carry it.

### `...(phone === undefined ? {} : { contactPhone: phone })`

Two columns, one number: `users.phone` is who the dealer is to us

### `...(phone === undefined ? {} : { contactPhone: phone })`

and `dealers.contactPhone` is what a buyer is shown. Onboarding

### `...(phone === undefined ? {} : { contactPhone: phone })`

writes both from one answer, so an edit has to as well — leaving

### `...(phone === undefined ? {} : { contactPhone: phone })`

the mirror stale would publish the old number.

### `async completeness(dealerId: string): Promise<CompletenessResponse>`

C3. Drives the onboarding stepper and gates `POST /v1/dealer/submit`.

### `if (!dealer.district) businessMissing.push('district')`

The district joins the required set rather than sitting beside it as a
nice-to-have. It is asked for on the same step as the city, it is what
the admin console filters on, and a filter that silently omits the
dealerships that skipped the question is a filter that lies. Rows
created before the column existed read as incomplete here, which is
true: they are, and the profile screen is where that is fixed.

### `if (!dealer.mapsUrl) businessMissing.push('mapsUrl')`

The directions link, named for the same reason the yard photograph is:
the public portfolio is "here is the yard, here is how to reach it",
and half of that missing is a page that quietly does less. Dealerships
created before the question was asked read as incomplete here, which is
true of them — the Business step is where it is fixed.

### `if (!dealer.tagline) businessMissing.push('tagline')`

The line and the services, required on the same footing as the address
and the link (**R26**). The public portfolio is the page a dealership
is judged on before anybody drives anywhere, and one with a photograph,
a pin and no sentence reads as an unfinished listing rather than a
business.

These two replaced `about`, which asked for the same thing at forty
times the length and got either a paragraph nobody read or twenty
characters of "we sell used cars". A dealership that had written one
but no tagline reads as incomplete here, which is correct — and moot
since **R33**, which dropped the column: whatever they wrote is not a
line under their name, and there is nothing left to read it out of.

Dealerships created before either was asked read as incomplete here.
That is true of them, and the Business step is where it is fixed.
There is no backfill for the same reason there is none for `mapsUrl`:
nobody but the dealer can write this sentence.

### `if (!dealer.coverMediaId) documentsMissing.push('YARD_PHOTO')`

The yard photograph sits on the documents step because that is the

### `if (!dealer.coverMediaId) documentsMissing.push('YARD_PHOTO')`

step where a dealer uploads things — but it is required for a

### `if (!dealer.coverMediaId) documentsMissing.push('YARD_PHOTO')`

different reason. It is the hero of the public portfolio, and a

### `if (!dealer.coverMediaId) documentsMissing.push('YARD_PHOTO')`

dealership whose storefront would open with an empty frame is not

### `if (!dealer.coverMediaId) documentsMissing.push('YARD_PHOTO')`

ready to be reviewed.

### `async submitForVerification(dealerId: string): Promise<DealerSubmitResponse>`

C4. DRAFT → PENDING_APPROVAL. No body; the state machine decides.

### `const resubmitted = Boolean(dealer.statusReason)`

A returned application is still a DRAFT, so capture the moderator's

### `const resubmitted = Boolean(dealer.statusReason)`

note before the transaction clears it. The event must carry this

### `const resubmitted = Boolean(dealer.statusReason)`

distinction: by the time the worker renders the email, the row is back

### `const resubmitted = Boolean(dealer.statusReason)`

in PENDING_APPROVAL and no longer says whether this was its first trip

### `const resubmitted = Boolean(dealer.statusReason)`

through the queue.

### `await repo.update(dealerId, { status: 'PENDING_APPROVAL', statusReason: null }, tx)`

`statusReason` is cleared on the way back into the queue.

It is set when an admin sends an application back for changes, and
the onboarding screen reads it two ways: as the banner explaining
what to fix, and — since it is the only mark distinguishing a
returned application from one that was never finished — as the signal
to reopen at step one. Leaving it behind would show the dealer a
complaint they have already answered.

### `async documents(dealerId: string): Promise<DealerDocumentsResponse>`

─────────── C5 KYC documents ─────────────────────────────────────────

### `async documents(dealerId: string): Promise<DealerDocumentsResponse>`

The checklist, as the onboarding step and the console both render it.

Every one of the three types is returned whether or not a row exists for
it — a response that grew as documents were uploaded would leave a
missing document looking like one that was never required.

### `async presignDocument(dealerId: string, input: DocumentPresignInput): Promise<PresignResponse>`

Documents go through the same presign → PUT → commit pipeline as photos,
with three differences: a private prefix, **no public delivery route**,
and no derivatives. The promise that buyers never see them is enforced by
there being no route that could serve them, not by a flag (§26.6).

### `const previous = await repo.documentByType(dealerId, input.type)`

Replacing removes what was there.

The row is about to be overwritten with a new id, and the stored
object's key ends in the old one — so this is the last moment anything
knows where the previous file is. Skip it and every replacement leaves
a KYC document sitting in storage that nothing references and nothing
will ever delete, which for scans of PAN cards is a retention problem
rather than a housekeeping one.

### `async deleteDocument(dealerId: string, type: DealerDocType): Promise<void>`

C5 delete. The row survives as `REQUIRED` — the checklist has three rows
whatever happens to them — but the bytes do not.

The row is read before it is reset, because the stored object's key ends
in the row's id. The baseline deleted `kyc/{dealerId}/{type}`, which is
the _prefix_ the object lives under rather than the object itself, so
every removed document stayed in storage. That is fixed here.

### `async yardPhoto(dealerId: string): Promise<YardPhotoDto>`

─────────── The yard photograph ──────────────────────────────────────

### `async yardPhoto(dealerId: string): Promise<YardPhotoDto>`

The image that will front this dealership's public portfolio.

It is deliberately not a fourth `DealerDocType`. The three KYC documents
are private, have no public delivery route and exist to be read once by a
moderator; this one is the first thing a buyer will ever see. Sharing the
pipeline is fine — sharing the checklist would mean sharing the privacy
rules, and those are the part that must not be got wrong.

It lands on `dealer.coverMediaId`, because a hero image of the premises
is exactly what that slot is for.

### `url: await storage.signedReadUrl(media.storageKey, YARD_PHOTO_URL_TTL_SECONDS)`

A signed read of the original, not a delivery URL.

The derivative pipeline that content-addresses an image and gives it
a permanent public URL is **F034**. Until it exists the original is
the only copy there is, and signing a read of it is the only honest
way to show a dealer what they uploaded. When F034 lands this becomes
`mediaUrl(media.id, …)` for a READY row and the row stops being
PENDING; nothing else about this path changes.

### `async commitYardPhoto(dealerId: string, input: YardPhotoCommitInput): Promise<YardPhotoDto>`

Commit, and displace whatever was there.

The delete happens _here_ rather than at presign — the opposite of the
KYC path — because nothing is overwritten until this point. A presign
that is never followed by a `PUT` leaves the dealership's existing yard
photograph exactly where it was, which is what a dealer who changed their
mind halfway through picking a file expects.

### `const displaced = dealer.coverMediaId`

READY, here, at commit.

`media.serve()` refuses anything that is not READY, and the only thing
that promotes a row is **F034**'s derivative worker — which does not
exist, and whose `media.process` job nothing consumes. So every yard
photograph ever uploaded sat at PENDING, and the public pages had no
image to show even once the dealership was approved.

Marking it here is not standing in for F034. The object has just been
HEADed, so the bytes are known to be there, and the presigned PUT
signed their content-type and length — which is what lets `serve()`
fall back to the original when a row has no variants yet. F034 adds
the re-encoded renditions and `serve()` prefers them the moment they
exist; nothing on this path changes when it lands.

### `async dashboard(dealerId: string): Promise<DashboardResponse>`

─────────── C18 dashboard ────────────────────────────────────────────

### `async dashboard(dealerId: string): Promise<DashboardResponse>`

One round trip, everything. `heightPct` is computed here against the
week's max so the chart cannot disagree with the numbers beside it.

── Reconstruction slice ──────────────────────────────────────────────
Every line below is the baseline's. What is held back is the six reads
it is built from — `viewRollups`, `previousWeekViews`, `enquiryCounts`,
`recentEnquiries`, `expiringListingCount` and `weeklyActivity` — each of
which queries a model that does not exist yet and each of which
therefore answers with the truth for zero rows. The repository carries
the baseline's query against each one, and the feature that restores it.

The derivation is deliberately **not** sliced. It is the part a reviewer
has to check against the baseline, and the part a later feature must not
re-invent; holding it back and computing zeros inline would hide it, and
restoring the models would then mean rewriting code that was never in
question.
──────────────────────────────────────────────────────────────────────

### `const max = Math.max(1, ...series.map((point) => point.views))`

One, not zero. Every height is a percentage of this, and a quiet week
is exactly the week a dealer looks at — a divide-by-zero there would
render `NaN%` on the one screen that has to keep working when there is
nothing to show.

### `const viewDelta =`

Null is "no data for last week"; zero is a real week with no traffic.
Reporting the first as the second is a fabricated −100% trend, which is
why the repository keeps the distinction rather than flattening it.

### `function documentStatusLabel`

The sub-line under each row. It is a sentence a dealer can act on rather than
an enum name — `REJECTED` tells them nothing, "Too blurry to read" tells them
what to do next.

### `function greeting(): string`

The time of day **in IST**, not in the server's zone.

The API runs in UTC, and "Good evening" at 21:00 IST is 15:30 UTC — an
afternoon by the clock the process is keeping. The dealers are in India; the
greeting is theirs, so it is computed in their zone.
