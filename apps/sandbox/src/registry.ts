/**
 * The searchable component index — this is what "search the sandbox first"
 * actually means.
 *
 * Discovery failure is the problem this repository has, measurably: `<Button>`
 * is used 29 times against 88 raw `className="btn …"` sites, a 75 % bypass
 * rate, and `.table` was hand-rolled in five separate pages. Nobody set out to
 * duplicate anything — they could not find what already existed.
 *
 * So every entry carries `aliases`. `dealer-card.tsx` exports `DirectoryCard`,
 * and somebody looking for "DealerCard" must still find it (finding D-6).
 */
export type Category =
  'Primitives' | 'Forms' | 'Vehicle' | 'Dealer' | 'Search' | 'Console' | 'Admin' | 'Layout';

export type Ownership =
  'Primitive' | 'Shared' | 'Feature-shared' | 'Feature-specific' | 'Page-specific';

export interface RegistryEntry {
  /** The component-map id, e.g. 'C032'. */
  id: string;
  name: string;
  /** Repository-relative path to the real component. */
  source: string;
  category: Category;
  ownership: Ownership;
  /** One line. What it is for, not what it looks like. */
  purpose: string;
  /** Every name someone might plausibly search for. The D-6 fix. */
  aliases: string[];
  /** F-numbers that render it. */
  features: string[];
  props: string[];
  states: string[];
  reusable: boolean;
  /** Storybook id, for deep links. */
  storyId: string;
}

/**
 * Populated one component at a time, by the feature that brings the component
 * across. An entry without a story, or a story without an entry, is a gap —
 * see `docs/project/component-sandbox.md` §5.
 */
export const registry: RegistryEntry[] = [];

/** Case-insensitive search across name, aliases, purpose and category. */
export function findComponent(query: string): RegistryEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return registry;

  return registry.filter((entry) =>
    [entry.name, entry.purpose, entry.category, ...entry.aliases]
      .join(' ')
      .toLowerCase()
      .includes(needle),
  );
}
