# web / components/search/related-searches

Parent: [web](../../../README.md)

## `apps/web/src/components/search/related-searches/related-searches.tsx`

### `export function RelatedSearches(...)`

The internal links between the SEO landing pages: a titled section of chips,
grouped. A server component of plain `<a>` elements, because the links are for
crawlers as much as for buyers — a link that appears only after hydration is
one a crawler may never follow.

The link text is the whole search ("Used Diesel Cars in Arcot"), not a facet
name with a count: anchor text is what tells a search engine what the target
page is about, and "Diesel (2)" says nothing about Arcot.

A group with no links is dropped, and with every group empty the component
renders nothing — a heading over an empty list reads as a fault. The link types
are in `apps/web/src/types` because `lib/landing` builds them.

### `collapsible` — `CollapsibleSearches`

On `/cars` the block is a preview: **two rows** of chips and a _See more_ that
opens the titled groups. Two rows, not one, because a chip is about 200px wide
and one row on a phone is one or two links — a stray button, not a preview.

**Collapsing hides nothing from crawlers.** Every link is in the server-rendered
HTML in both states; the collapsed panel only clips them (`max-h` and
`overflow-hidden`), so the `/cars` page still links every landing page.

**One set of elements, two layouts.** Collapsed, the group wrappers and lists
are `display: contents` and their headings `sr-only`, so the chips flow as one
row; expanded, the same elements show as titled groups. Swapping one list for
another would unmount a link that has keyboard focus — and a clipped link _can_
take focus, which is why focus inside the panel opens it.

_See more_ hides itself when everything already fits, measured with a
`ResizeObserver`; without one it stays, which is the safe default. The client
boundary is only this toggle: the chips and groups are the server components the
non-collapsible block renders.
