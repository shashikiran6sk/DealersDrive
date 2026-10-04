# web / app

Parent: [web](../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/app/layout.tsx`

### `const inter = Inter(`

Inter is self-hosted through `next/font`; Cabinet Grotesk comes from
Fontshare with Inter as its declared fallback (DESIGN-SPEC §1.3), so the
app degrades to the specified fallback rather than to a system serif when
that request fails.

### `const config = serverConfig()`

Read at runtime, in a server component, and passed down — never inlined

### `const config = serverConfig()`

into the bundle as a NEXT_PUBLIC_* variable (ARCHITECTURE §15.3).

### `export function generateMetadata(): Metadata`

A function rather than a `metadata` constant so `WEB_BASE_URL` and `APP_ENV`
are read when the page renders, not when the module is first imported. See
[lib/seo](lib.md).

## `apps/web/src/app/robots.ts` · `apps/web/src/app/sitemap.ts`

### `await connection()`

Both answer per request. Without it Next renders them once at build, with the
build's environment and — for the sitemap — with no API to ask, which would
ship a four-URL sitemap and a robots.txt that says whatever `APP_ENV` was in
CI. The sitemap's two reads are still cached for an hour in the data cache and
tagged `vehicles`/`dealers`, so a crawler hitting it does not reach the
database.

### `apiGetParsed(PublicSitemapResponse, '/v1/sitemap', …)`

Not `getPublicLocations()`, which swallows a failure into an empty list: a
sitemap that quietly drops every district page while the API is down is worse
than a 5xx, which a crawler retries.

## `apps/web/src/app/favicon.ico` · `icon.png` · `apple-icon.png`

The header's mark — the `#0c0c0b` tile, `DD` in Manrope 800 — rendered at
16/32/48 (the `.ico`), 512 and 180. The Apple icon is full-bleed and square
because iOS draws its own corners, and transparent ones come out black. They
were rendered with the `next/og` renderer and the Manrope font the app already
uses; there is no older logo anywhere in the repository to reuse.

## `apps/web/src/app/page.tsx`

### `export default function Page()`

Placeholder route. `next build` needs at least one page, and the homepage is
F081 — so this holds the slot without pretending to be the product.

## `apps/web/src/app/not-found.tsx`

### `export default function NotFound()`

Unmatched URLs. It draws the real public shell rather than a bare page: a
mistyped link should land somewhere a visitor can carry on from. The public
group's own `not-found.tsx` handles `notFound()` from its pages, inside its
layout.

## `apps/web/src/app/error.tsx` · `apps/web/src/app/global-error.tsx`

### `<StatusShell>`

A logo and nothing that fetches: these catch failures above the route groups,
where the thing that failed may be a layout, so they must not depend on one.
`global-error.tsx` replaces the root layout and so renders its own `<html>` and
`<body>` and imports the stylesheet and the font itself.

## `apps/web/src/app/(dealer)/error.tsx`

### `export default function DealerConsoleError(props)`

At the group, above the dealer layout, so a failure of the layout itself is
caught too — which is why it brings `StatusShell` rather than assuming the
console's navigation rendered. "Back to the dashboard" rather than the
marketplace homepage.

## `apps/web/src/app/(admin)/admin/layout.tsx`

The Admin header keeps its desktop row. Below the small breakpoint it grows
with its contents, places Operations above a width-bounded account row, and
lets the operator email break while preserving the review link and Sign out.
The server metrics request and Admin authorization remain authoritative.

## `apps/web/src/app/(admin)/admin/dealers/page.tsx`

Dealer status tabs have a page-width bound and local horizontal scrolling.
Their labels keep their width so narrow screens can reach every status
without creating horizontal document overflow. Wide tables retain their
existing scroll containers.
