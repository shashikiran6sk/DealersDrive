# web / components/seo

Parent: [web/components](README.md)

## `apps/web/src/components/seo/json-ld/json-ld.tsx`

### `export function JsonLd({ nodes }: JsonLdProps)`

One `<script type="application/ld+json">` per page, holding every node in one
`@graph` so the car and its breadcrumb, or the dealership and its breadcrumb,
are one document that can refer to each other by `@id`. Nothing renders when a
page has no nodes.

It is the only place `dangerouslySetInnerHTML` meets structured data, and it
goes through `serializeJsonLd` — see [lib/seo](../lib.md). It has no sandbox
entry: it draws nothing.
