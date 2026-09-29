# web / components/layout/public-shell

Parent: [web/components/layout](README.md)

## `apps/web/src/components/layout/public-shell/public-shell.tsx`

### `export async function PublicShell({ children })`

The public header, `<main>` and footer, with the saved-cars provider around
them. Moved out of `app/(public)/layout.tsx` so the root `not-found.tsx` — which
sits outside the route group — draws the same shell. Its two reads swallow
their failures into empty defaults, so the shell renders during an outage and
the page inside it can say what went wrong.
