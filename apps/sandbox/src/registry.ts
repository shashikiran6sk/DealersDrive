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
export const registry: RegistryEntry[] = [
  {
    id: 'C001',
    name: 'Button',
    source: 'apps/web/src/components/ui/button.tsx',
    category: 'Primitives',
    ownership: 'Primitive',
    purpose: 'Every action in the product. 5 variants x 5 sizes, block, loading.',
    aliases: ['Btn', 'CTA', 'SubmitButton', 'ActionButton', 'btn'],
    features: ['F009'],
    props: ['variant', 'size', 'block', 'loading', 'disabled', 'children'],
    states: ['default', 'hover', 'active', 'disabled', 'loading', 'block'],
    reusable: true,
    storyId: 'primitives-button',
  },
  {
    id: 'C002',
    name: 'ButtonLink',
    source: 'apps/web/src/components/ui/button.tsx',
    category: 'Primitives',
    ownership: 'Primitive',
    purpose: 'A Button that navigates — an anchor, so middle-click still works.',
    aliases: ['LinkButton', 'AnchorButton', 'NavButton'],
    features: ['F009'],
    props: ['href', 'variant', 'size', 'block', 'children'],
    states: ['default', 'hover', 'active'],
    reusable: true,
    storyId: 'primitives-button--as-link',
  },
  {
    id: 'C003',
    name: 'Plate',
    source: 'apps/web/src/components/ui/primitives.tsx',
    category: 'Primitives',
    ownership: 'Primitive',
    purpose: 'The registration plate. The signature element, in exactly four places.',
    aliases: ['RegistrationPlate', 'NumberPlate', 'YearBadge', 'VerifiedChip', 'dd-plate'],
    features: ['F009'],
    props: ['size', 'children'],
    states: ['year', 'logo', 'chip', 'marker'],
    reusable: true,
    storyId: 'primitives-plate',
  },
  {
    id: 'C004',
    name: 'StatusTag',
    source: 'apps/web/src/components/ui/primitives.tsx',
    category: 'Primitives',
    ownership: 'Primitive',
    purpose: 'A status badge. Never colour alone — the label always carries the meaning.',
    aliases: ['StatusBadge', 'StatusChip', 'Pill', 'tag-ok', 'tag-err'],
    features: ['F010'],
    props: ['tone', 'children'],
    states: ['ok', 'warn', 'err', 'neutral', 'accent'],
    reusable: true,
    storyId: 'primitives-statustag',
  },
  {
    id: 'C005',
    name: 'Tag',
    source: 'apps/web/src/components/ui/primitives.tsx',
    category: 'Primitives',
    ownership: 'Primitive',
    purpose: 'The non-status sibling of StatusTag. Three variants, no semantics.',
    aliases: ['Chip', 'Label', 'Badge', 'tag-neutral', 'tag-outline'],
    features: ['F010'],
    props: ['variant', 'children'],
    states: ['neutral', 'accent', 'outline'],
    reusable: true,
    storyId: 'primitives-statustag--tag-variants',
  },
  {
    id: 'C006',
    name: 'Banner',
    source: 'apps/web/src/components/ui/primitives.tsx',
    category: 'Primitives',
    ownership: 'Primitive',
    purpose: 'Inline page-level message. The most-imported component in the product.',
    aliases: ['Alert', 'Notice', 'Callout', 'InlineMessage', 'Toast'],
    features: ['F010'],
    props: ['tone', 'title', 'children', 'action'],
    states: ['ok', 'warn', 'err', 'title-only', 'body-only', 'with-action', 'long-text'],
    reusable: true,
    storyId: 'primitives-statustag--banner-tones',
  },
];

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
