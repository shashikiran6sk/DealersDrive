# web / components/layout/district-scoped-link

Parent: [web/components/layout](README.md)

## `apps/web/src/components/layout/district-scoped-link/district-scoped-link.tsx`

### `export function DistrictScopedLink(...)`

The web has no shared location store: the district is the URL's `?district=`
(R23). When the home page stopped redirecting on a district choice (F114), the
choice had to reach the next page some other way. Otherwise _Browse dealers_ would
quietly forget it, and the header pill would reset on arrival. This link carries
the current page's district onto its `href`.

It is a client component only because it reads `useSearchParams`. It sits inside
its own `Suspense` boundary with the plain link as the fallback, so the home page
still prerenders and the link works before hydration.

## `apps/web/src/components/layout/district-scoped-link/utils.ts`

### `export function scopedHref(href, district)`

Only a slug-shaped district is carried, the same shape the search contract
accepts, so a hand-typed `?district=Not A Slug` cannot be forwarded into a 400. An
existing query on the `href` is kept.
