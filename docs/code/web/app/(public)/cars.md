# web / app/(public)/cars

Parent: [web](../../README.md)

## `apps/web/src/app/(public)/cars/page.tsx`

### `export default async function CarsPage(...)`

The marketplace list (**F077** as scoped by **R45**): the approved cars,
newest first, a page at a time. No filters, sort or search yet — those are
F076/F078/F080 and deferred — so the page takes one query parameter, `page`,
and ignores anything that is not a positive integer rather than passing it to
the API.

The response is parsed with `PublicVehiclesResponse` (`apiGetParsed`), and the
fetch is tagged `vehicles` so an approval in the admin console revalidates it
at once rather than after the minute's cache.

It is indexable now that it lists real cars; it replaced a coming-soon page.
