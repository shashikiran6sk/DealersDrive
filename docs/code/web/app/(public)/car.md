# web / app/(public)/car

Parent: [web](../../README.md)

## `apps/web/src/app/(public)/car/[slug]/`

### Why the car page has no `loading.tsx` (BUG-101)

R101 gave this route a `loading.tsx`, and with it the page answered **HTTP 200**
for a car that does not exist and for an API outage. A loading component is a
Suspense boundary around the page, so Next flushes the layout and the skeleton —
and with them the status line — before the page has asked the API anything. The
`notFound()` and the thrown outage that follow can only swap the streamed content
for the not-found or error UI; the status is already sent. Crawlers saw a soft
404 on every removed car and a 200 on every outage.

Measured against a production build of Next.js 15.5.27 (`next dev` answers 404
either way, so the bug only shows in a build):

| `/car/…`                          | with `loading.tsx` | without |
| --------------------------------- | -----------------: | ------: |
| a public car                      |                200 |     200 |
| an unknown or non-public slug     |                200 |     404 |
| a cold page while the API is down |                200 |     500 |

Without the file the not-found page still renders "Page not found" and the error
boundary still renders "Something went wrong" with its retry, both `noindex`.

What the boundary bought was instant feedback on a click (R101, see
[vehicle-page-loading](../../components/vehicle/vehicle-page-loading.md)). That
feedback now comes from the link that was clicked — `VehicleCard`'s
`LinkPendingIndicator` — the same answer F114 gave the dealership page
([`dealers/[slug]`](dealers/[slug].md)). Do not add a `loading.tsx` here again
without re-checking the status codes against a production build.

## `apps/web/src/app/(public)/car/[slug]/page.tsx`

### `export default async function VehiclePage(...)`

**R100 — the similar cars no longer wait for the car.** Both requests start
together; the similar cars are asked for again only when the API answered with a
different canonical slug. `loadSimilar` never rejects (a failure is an empty
row), so a `notFound()` on the car leaves no unhandled promise behind. Measured
on cold pages at 150 ms per API call: 377–408 ms → 204–315 ms.

The vehicle page (**F082** as scoped by **R45**). The API answers 404 for
anything not public, and 400 for a slug no slug could be; both render the
not-found page, so a car in review or taken down is indistinguishable from one
that never existed. Any other failure reaches the error boundary rather than
pretending the car is missing.

The fetch is tagged `vehicles` and `vehicle:{slug}` and revalidates within a
minute; approval revalidates the `vehicles` tag. The page is indexable with a
canonical of `/car/{slug}`.

**SEO.** `generateMetadata` and the page call the same `loadVehicle`, whose
fetch Next memoises, so the metadata costs no second request. The title is
`Used {title} for Sale in {town}` — the words a buyer types ("used Kia Seltos
Vellore", "Tata Nexon for sale in Vellore") are the words a search engine
matches, and the brand suffix is added by the template; the description is built from the price, the summary
and the dealership, and says "Reserved for another buyer." first on a reserved
car. The primary photograph is the social image. `Car`/`Product` + `Offer` +
`BreadcrumbList` come from `lib/seo/schemas`; see [lib](../../lib.md) and
docs/seo.md §7 for what each lifecycle state answers.

**R65** puts **Enquire now** under the price. It changes nothing about how the
page is rendered: the panel is a client component that asks who is signed in
only when pressed ([features/enquiry](../../features/enquiry.md)), and
`?enquire=1` is read under a `Suspense` boundary whose fallback is the same
button, so the page stays static and one cached copy serves every visitor. The
bottom padding grows below `lg` by the height of the pinned Enquire bar.
