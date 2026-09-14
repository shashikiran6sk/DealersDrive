# web / app/(public)/dealers

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/(public)/dealers/page.tsx`

### `export const dynamic = 'force-dynamic'`

`/dealers` — the directory grid, a name search and the city chips.

SEO, and a directory changes at the pace of onboarding — so the fetches below
cache for 10 minutes. The _route_ is dynamic on purpose: a prerendered route
would call the API during `next build` and bake that environment's dealers
into the image (§20.1).

### `function readParams(params: SearchParamsInput):`

The URL is the filter state, so this is the one place it is read.

`city` is a list — the chips are toggles — and travels as one comma-separated
parameter rather than a repeated one, which is the form the API's schema
accepts and the form that survives being pasted into a chat window.

### `function cityParam(city: string[]): string | undefined`

The list, back in the shape the API and the links both want.

### `...seoMetadata(`

A name search is a thin, unbounded surface; a place page is a real one.
**One** town is a real one — two toggled together is a comparison a buyer
made for themselves, and there is no audience searching for the pair, so
it is passed through as a multi-value and the policy declines to index it
exactly as it declines a name search.

### `function placeName`

What to call the place in a heading: the town when exactly one is chosen, the
district otherwise, and nothing at all on the unfiltered page.

The baseline said "Dealers near Tamil Nadu" with no filter at all, which was
a hard-coded state from the days when the platform had five towns in one of
them (D6).

### `const [directory, locations] = await Promise.all([`

Two reads, one round trip. `getPublicLocations` is the same cached fetch
the layout above already made — same URL, same options — so this is a hit
rather than a second call to the API, and the picker below cannot disagree
with the header about which districts exist (**R23**).

### `<h1 className="text-[34px]">{place ? `Dealers in ${place}` : 'Verified dealers'}</h1>`

The heading names a place only when one was chosen. The baseline said
"Dealers near Tamil Nadu" on the unfiltered page, which was a
hard-coded state from the days when the platform had five towns in one
of them (D6).

### `<div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]">`

No row rule any more (**R21**). `grid-auto-rows: 1fr` arrived with R17
to make every card in a row match the tallest one in it — which made
them equal without making them fixed: a dealership writing a longer
tagline still grew every card on the page. The card carries a hard
height now, so equal rows are what it produces rather than something
the grid has to arrange, and leaving the rule here would only be a
second mechanism for a job already done.
