# api / http

Parent: [api](../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/http/route.ts`

### `export type RouteRegistrar<TDeps> = (router: Router, deps: TDeps) => void`

One route, in one file, registering itself on its module's router.

`<module>.routes.ts` holds the list and the order; each entry in that list is
a file next to it under `routes/`. Order is the list's, because Express
matches in registration order.
