# web / app/(public)/car

Parent: [web](../../README.md)

## `apps/web/src/app/(public)/car/[slug]/page.tsx`

### `export default async function VehiclePage(...)`

The vehicle page (**F082** as scoped by **R45**). The API answers 404 for
anything not public, and 400 for a slug no slug could be; both render the
not-found page, so a car in review or taken down is indistinguishable from one
that never existed. Any other failure reaches the error boundary rather than
pretending the car is missing.

The fetch is tagged `vehicles` and `vehicle:{slug}` and revalidates within a
minute; approval revalidates the `vehicles` tag. The page is indexable with a
canonical of `/car/{slug}`; structured data and the rest of the SEO work are
deferred.
