# web / components/admin/admin-list-loading

Parent: [web/components/admin](README.md)

## `apps/web/src/components/admin/admin-list-loading/admin-list-loading.tsx`

### `export function AdminListLoading()`

**R89.** The `loading.tsx` of an admin list route. The console's pages are
server components that read uncached, so a slow read used to leave the previous
page on screen with nothing to say a new one was coming. One `role="status"`
with a name, so a screen reader hears "Loading" once rather than a row of
unlabelled boxes.

### `export function AdminDetailLoading()`

The same for a detail route, in the two auto-fitting columns the listing review
and the enquiry detail both use.
