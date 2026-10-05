# web / app/(public)/car

Parent: [web](../../README.md)

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
`{title} in {town}`; the description is built from the price, the summary
and the dealership, and says "Reserved for another buyer." first on a reserved
car. The primary photograph is the social image. `Car` + `Offer` +
`BreadcrumbList` come from `lib/seo/schemas`; see [lib](../../lib.md) and
docs/seo.md §7 for what each lifecycle state answers.

**R65** puts **Enquire now** under the price. It changes nothing about how the
page is rendered: the panel is a client component that asks who is signed in
only when pressed ([features/enquiry](../../features/enquiry.md)), and
`?enquire=1` is read under a `Suspense` boundary whose fallback is the same
button, so the page stays static and one cached copy serves every visitor. The
bottom padding grows below `lg` by the height of the pinned Enquire bar.
