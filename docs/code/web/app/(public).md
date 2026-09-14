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
