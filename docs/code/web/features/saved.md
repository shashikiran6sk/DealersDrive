# web / features/saved

Parent: [web](../README.md)

Saved cars in the browser (**R75**), over the server-backed list R74 built.

## `apps/web/src/features/saved/saved-vehicles-provider.tsx`

### `export function SavedVehiclesProvider(props)`

One provider in the public layout, so every heart on a page — a card in
`/cars`, the same car in "Similar vehicles", the labelled button on its own
page — reads one set of saved slugs and moves together. The set is asked for
once, through `savedSlugsAction`. Like `HeaderAccount`, that happens after
mount, so the public pages stay static and cacheable.

**Optimistic, with the server authoritative.** A tap flips the heart at once
and marks the slug pending, which disables the button against a double tap.
The server's answer then decides the result:

- a success keeps the server's `saved`
- a refusal flips the heart back and announces the API's sentence in a polite
  live region
- a signed-out answer flips it back and goes to the login

On `/saved` a success also calls `router.refresh()`, so the page's groups
follow.

**The sign-in intent** is the enquiry's pattern (R65) applied to saving. A
signed-out tap goes to `/login?returnTo=<this page>?save=<slug>`, keeping the
page's own query, so a filtered `/cars` comes back filtered. `SaveFromUrl`
reads `save` on the way back, strips it with `router.replace`, and saves the
car unless it is already saved. The visitor never has to press the heart
twice.

It lives in its own `Suspense` because `useSearchParams` in the layout would
otherwise make every public page render on the client. The provider itself
reads the URL only when a heart is tapped, through `window.location.search`.

## `apps/web/src/components/vehicle/save-button/saved-vehicles-context.ts`

### `export const NO_SAVED_VEHICLES`

The context's default is "disabled", not "throw". The baseline's
`useSavedCars()` threw outside its provider, which made a provider decorator
mandatory for every vehicle story (coupling C-1). Here a card rendered anywhere
without the provider simply has no heart. The context lives in `components/`
and the provider in `features/`, so a shared component never imports a
feature.

## `apps/web/src/features/saved/actions.ts`

### `export async function setSavedAction(slug, saved)`

`PUT` or `DELETE` on `/v1/saved-vehicles/:slug`. Without a session cookie it
answers `signed-out` without calling the API, as the enquiry action does. It
revalidates `/saved`, the only page whose content is the saved list.

## `apps/web/src/features/saved/saved-list/saved-list.tsx`

### `export function SavedList({ saved })`

`/saved` groups what the customer saved by what became of each car:

- **Available**
- **Reserved**, still on show with enquiries paused
- **No longer available**, sold or withdrawn

Every group uses the shared `VehicleCard`, so a reserved or departed car is
greyed, badged and unlinked exactly as on the marketplace, and every card keeps
its heart so it can be removed. Nothing is hidden from the list: R74 never
deletes a saved row, and the page does not pretend a car is still for sale.
