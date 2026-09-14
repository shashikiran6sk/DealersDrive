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

## `apps/web/src/app/page.tsx`

### `export default function Page()`

Placeholder route. `next build` needs at least one page, and the homepage is
F081 — so this holds the slot without pretending to be the product.
