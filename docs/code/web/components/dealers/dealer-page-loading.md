# web / components/dealers/dealer-page-loading

Parent: [web/components/dealers](README.md)

## `apps/web/src/components/dealers/dealer-page-loading/dealer-page-loading.tsx`

### `export function DealerPageLoading`

`app/(public)/dealers/[slug]/loading.tsx` (**R101**). The dealership page is
rendered on demand, so a directory card's click had nothing to show until the
page was built. The skeleton follows the page's own sections — back link, logo
tile and name, the yard photograph's slot at its three heights, then the
inventory grid as `VehicleCardSkeleton`s — so the page lands where it was drawn.

`/dealers` and `/cars` deliberately have no `loading.tsx`: their filters change
the URL's search params, and a boundary there would replace the results with a
skeleton on every filter click instead of keeping them while the next set loads.

### No route renders it since F114

`app/(public)/dealers/[slug]/loading.tsx` was removed, because with it Next.js
dropped `scroll: false` on every inventory filter change and the page jumped to the
top. The full trace is in [`dealers/[slug]`](<../../app/(public)/dealers/[slug].md>).
The component, its sandbox story and its skeleton test stay, so the owner can
decide whether to delete it or use it for a different, non-search-parameter
transition.
