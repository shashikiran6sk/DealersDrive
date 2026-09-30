# web / app/(public)

Parent: [web](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/(public)/layout.tsx`

### `export default async function PublicLayout({ children }: { children: ReactNode })`

The buyer shell. No authentication anywhere below this layout, and no
sign-in gate on the catalogue, a vehicle page, a portfolio or an enquiry
form (DESIGN-SPEC §4.10).

The one thing it fetches is the header's location list. It replaces the
baseline's `GET /v1/cities` — **D6** withdrew that endpoint with the `cities`
table — and answers a better question besides: the districts dealerships are
actually in, counted, rather than the five towns somebody seeded.

The fetch, why it is parsed rather than cast, and why it degrades to an empty
list rather than throwing, all moved to `lib/locations.ts` at **R23**, when
the directory became a second caller. The reasoning is there in full.

The second fetch is the footer's, added at **R44**: the support contacts and
the social links it renders are platform configuration rather than code, so
an operator can correct a number or a dead profile link from `/admin/config`
without a deploy (Rule 9 — `NEXT_PUBLIC_*` would bake them into the image).
It degrades the same way the first one does, and for the same reason: a throw
in a layout escapes every boundary below the root.

The two run together. They are independent reads of two different endpoints,
and awaiting them in sequence would put a round trip on every public page for
no reason.

`SavedCarsProvider` wraps this tree from **F087**.

## `apps/web/src/app/(public)/page.tsx`

### The page is `HOME_FLOW`, in order (R83)

Below the hero, car rows and informational sections take turns — Recently
added, the journey, SUVs, why Dealers-Drive, automatic cars, built for both
sides, under ₹10 lakh — rather than every explainer waiting at the bottom. The
order is data (`HOME_FLOW` in `home.constants.ts`), so the page is one map and
a test can hold the sequence. Moving a section is moving a line.

The rows are still the four `loadHomeInventory()` reads, fetched once, in
parallel, and looked up by id; composition never adds a read. A row with no cars
renders nothing at all (`DiscoveryBand`), padding included, so an empty row
closes up rather than leaving a gap between two explainers.

### The hero search is `CarSearchBox` (R79)

The homepage search is the `/cars` search box, not a second search. It used to
be four selectors (district, brand, model, budget) with a Search button; R79
replaced them with the one text box `/cars` already has, so a buyer types a
make, model or variant and is shown the same suggestions from the same
endpoint. Choosing one opens `/cars` with it as filters; Enter on free text
opens `/cars?q=…`. There is no button, as on `/cars`.

It gets no params, so it searches the whole marketplace. The header's district
picker already sends a buyer to `/cars?district=…`, so the homepage has no
district of its own to scope by.

`action="/cars"` keeps what the four-field hero had: a GET form that works
before the script loads.
