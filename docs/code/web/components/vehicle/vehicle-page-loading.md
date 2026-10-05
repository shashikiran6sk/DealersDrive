# web / components/vehicle/vehicle-page-loading

Parent: [web/components/vehicle](README.md)

## `apps/web/src/components/vehicle/vehicle-page-loading/vehicle-page-loading.tsx`

### `export function VehiclePageLoading`

`app/(public)/car/[slug]/loading.tsx` (**R98**) — the fix for "I click a car on
the home page, nothing happens, and three or four seconds later the page
appears".

The vehicle page is dynamic, and a dynamic route with no loading boundary is not
prefetched at all, so the click waited for the whole render: the vehicle, then
its similar cars, each a cross-region call on a cold cache. With the boundary,
the cards' `<Link>`s prefetch this skeleton as they scroll into view, and the
click paints it at once (40–75ms measured, against 900ms+ at 800ms per API call).

The layout mirrors the page: the "All cars" button, the 4:3 gallery with its
thumbnail strip, then the rail — year plate, title, summary, the price card, the
Enquire button and the dealer card. The page itself also stopped fetching its
similar cars only after the vehicle: both start together now, and the similar
cars are asked for again only when the API answered with a different canonical
slug.
