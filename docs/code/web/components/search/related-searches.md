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
