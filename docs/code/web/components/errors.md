# web / components/errors

Parent: [web/components](README.md)

The branded failure UI. [`docs/errors.md`](../../../errors.md) says when each
appears.

## `apps/web/src/components/errors/status-page/status-page.tsx`

### `export function StatusPage(props)`

The full-page 404 and error screen: an eyebrow code, one `<h1>`, one sentence,
the actions, and an optional reference. No hooks, so it renders in a server
`not-found.tsx` and a client `error.tsx` alike. On a phone the actions stack
full width, the way the revamp's primary actions do.

### `export function NotFoundState()`

"Page not found", Go to homepage and Browse cars. The only copy on the 404.

## `apps/web/src/components/errors/route-error/route-error.tsx`

### `export function RouteError({ error, reset, description, homeHref, homeLabel })`

What every `error.tsx` renders. It reads `error.digest` and nothing else off the
error — the message is never rendered, in any environment. It writes its own
`<title>` and `noindex` (React hoists them into `<head>`), because an
`error.tsx` is a client component and cannot export metadata.

## `apps/web/src/components/errors/retry-button/retry-button.tsx`

### `startTransition(() => { router.refresh(); onRetry?.(); })`

`reset()` alone re-renders the boundary's children on the client, which for a
server component re-renders the same failure. Refreshing asks the server for
the route again; doing both in one transition is the pattern Next documents
for server-component errors. If the API is still down the error comes back and
the screen stays where it is — nothing navigates, so nothing loops.

## `apps/web/src/components/errors/section-error/section-error.tsx`

### `export function SectionError({ title, message, className })`

A section failing while its page did not: `ErrorState` with a Try again. Used
for the homepage rows and a dealer's inventory.

## `apps/web/src/components/errors/status-shell/status-shell.tsx`

### `export function StatusShell({ children })`

The header's mark and name, linked home, and nothing that fetches — for the
boundaries that cannot trust a layout.
