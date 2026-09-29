import type { JsonLdNode } from '../json-ld';
import { absoluteUrl } from '../site';

export interface ListedPage {
  name: string;
  path: string;
}

export function itemListSchema(
  name: string,
  entries: readonly ListedPage[],
  offset = 0,
): JsonLdNode {
  return {
    '@type': 'ItemList',
    name,
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: offset + index + 1,
      name: entry.name,
      url: absoluteUrl(entry.path),
    })),
  };
}
