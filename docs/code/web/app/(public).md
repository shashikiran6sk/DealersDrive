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

## `apps/web/src/app/(public)/layout.tsx` — `<PublicShell>`

The shell moved to `components/layout/public-shell` so the root `not-found.tsx`
can draw the same header and footer; this layout is now only that.

## `apps/web/src/app/(public)/not-found.tsx`

### `export default function PublicNotFound()`

`notFound()` from `/car/[slug]` and `/dealers/[slug]` lands here, inside the
public layout, rather than bubbling to the root boundary.

## `apps/web/src/app/(public)/error.tsx` and the four route boundaries

### `<RouteError {...props} description={ROUTE_ERROR_TEXT.cars} />`

One component, one sentence each: `/cars`, `/car/[slug]`, `/dealers` and
`/dealers/[slug]` say which thing could not be loaded. They exist only for that
sentence; the behaviour is `RouteError`'s.

### Why there is no `loading.tsx` here

A Suspense boundary above a page streams the layout before the page's data
arrives, and a `notFound()` or a failure after that is answered 200. See
`docs/errors.md` §3.
