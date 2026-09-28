# web / components/layout/customer-header

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/layout/customer-header/customer-header.tsx`

### `export function CustomerHeader({ locations, account }: CustomerHeaderProps)`

DESIGN-SPEC §3.1 — sticky, 64px, white on a hairline.

A client component for one reason: `usePathname`, which marks the current
section. Everything else it renders is a link, so if the pathname ever stops
being read here the `'use client'` should go with it (invariant 8).

── Reconstruction slice ────────────────────────────────────────────────────
The **saved-cars count** is **F087**: `Saved cars` is a plain link here,
because the badge needs `SavedCarsProvider`, which reads `localStorage`. The
location button is **districts** rather than the baseline's cities — see
`LocationSelector` for why that is the better question at this level. The nav
points at `/cars` (**F077**), `/dealers` (**F085**) and `/saved` (**F087**),
which land after this one — the cost of bringing the shell across before the
rooms it frames.
────────────────────────────────────────────────────────────────────────────

### `<Suspense fallback={<LocationChipFallback />}>`

The selector is the only part of the header that reads the query
string, and `useSearchParams` opts a route out of static prerendering
unless it sits behind a boundary. Keeping the boundary this tight
means the rest of the header still renders on the server.

### `{account ?? (<Link href={HEADER_NAV.login} …>)}`

One door, `Login` (**R35**, renamed at **R63**), visible at every width
because it is the only way in. From **R67** the corner is a slot: the public
layout passes `HeaderAccount`, which becomes "Hi, name" and Logout for a
signed-in customer. A slot rather than an import so this shared layout
component does not depend on a feature's Server Actions; without one the
header still renders the plain Login link, which is what every existing
consumer and test sees.

### `px-4 sm:px-6`, `max-sm:sr-only` on the wordmark

At phone width the header did not fit: the logo, the wordmark, the district
chip and Login measured 450px in a 390px viewport, pushing Login off-screen.
DESIGN-SPEC §3.1 at 375 draws "logo + city + CTA only", so the wordmark is
visually hidden below `sm` (still read by a screen reader) and the gutter is
the 16px every phone layout uses. Found and fixed at **R67**, when the signed-in
corner made the overflow worse.

## `apps/web/src/components/layout/customer-header/header-link.tsx`

### `export function HeaderLink(`

`aria-current="page"` as well as the colour, because status is never carried
by colour alone (DESIGN-SPEC §4.15).

## `apps/web/src/components/layout/customer-header/location-chip-fallback.tsx`

### `export function LocationChipFallback()`

The button's own footprint, so the header does not reflow when the real one
arrives. It reads "Select district" because that is what the button says for
every visitor who has not chosen one (**R23**).
