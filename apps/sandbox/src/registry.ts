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
  {
    id: 'C007',
    name: 'Blueprint',
    source: 'apps/web/src/components/ui/primitives.tsx',
    category: 'Primitives',
    ownership: 'Primitive',
    purpose: 'The framed panel. All four registration marks, always (DESIGN-SPEC 4.4).',
    aliases: ['Frame', 'Panel', 'BlueprintFrame', 'Corners', 'blueprint'],
    features: ['F011'],
    props: ['as', 'className', 'children'],
    states: ['div', 'section', 'article'],
    reusable: true,
    storyId: 'primitives-structure--blueprint-frame',
  },
  {
    id: 'C008',
    name: 'Avatar',
    source: 'apps/web/src/components/ui/primitives.tsx',
    category: 'Primitives',
    ownership: 'Primitive',
    purpose: 'Initials tile for a person. Decorative — aria-hidden.',
    aliases: ['UserAvatar', 'Initials', 'ProfilePic', 'Gravatar'],
    features: ['F011'],
    props: ['initials', 'size'],
    states: ['20px', '22px', '1-3 letters'],
    reusable: true,
    storyId: 'primitives-structure--identity-tiles',
  },
  {
    id: 'C009',
    name: 'LogoTile',
    source: 'apps/web/src/components/ui/primitives.tsx',
    category: 'Primitives',
    ownership: 'Primitive',
    purpose: 'Initials tile for a dealership. The bordered sibling of Avatar.',
    aliases: ['DealerLogo', 'BrandTile', 'Logo', 'Initials'],
    features: ['F011'],
    props: ['initials', 'size'],
    states: ['42px', '44px', '1-3 letters'],
    reusable: true,
    storyId: 'primitives-structure--identity-tiles',
  },
  {
    id: 'C010',
    name: 'StatCard',
    source: 'apps/web/src/components/ui/primitives.tsx',
    category: 'Primitives',
    ownership: 'Primitive',
    purpose: 'A labelled number with an optional toned delta.',
    aliases: ['Stat', 'Metric', 'KpiCard', 'CounterCard'],
    features: ['F011'],
    props: ['label', 'value', 'delta', 'deltaTone'],
    states: ['ok', 'warn', 'err', 'neutral', 'no-delta', 'long-value'],
    reusable: true,
    storyId: 'primitives-structure--stats',
  },
  {
    id: 'C011',
    name: 'ImageSlot',
    source: 'apps/web/src/components/ui/primitives.tsx',
    category: 'Primitives',
    ownership: 'Primitive',
    purpose: 'Placeholder panel naming the shot, when a vehicle has no photo.',
    aliases: ['ImagePlaceholder', 'PhotoSlot', 'NoImage', 'Fallback', 'image-slot'],
    features: ['F011'],
    props: ['label'],
    states: ['landscape', 'square'],
    reusable: true,
    storyId: 'primitives-structure--image-placeholder',
  },
  {
    id: 'C012',
    name: 'EmptyState',
    source: 'apps/web/src/components/ui/primitives.tsx',
    category: 'Primitives',
    ownership: 'Primitive',
    purpose:
      'Nothing-here panel. A Blueprint with a title, a clamped message and an optional action.',
    aliases: ['NoResults', 'Blank', 'ZeroState', 'Placeholder', 'NothingFound'],
    features: ['F012'],
    props: ['title', 'message', 'action'],
    states: ['plain', 'with-action', 'long-message'],
    reusable: true,
    storyId: 'primitives-states--empty',
  },
  {
    id: 'C013',
    name: 'ErrorState',
    source: 'apps/web/src/components/ui/primitives.tsx',
    category: 'Primitives',
    ownership: 'Primitive',
    purpose: 'Something-broke panel, with an optional retry.',
    aliases: ['ErrorPanel', 'Failure', 'RetryState', 'LoadError'],
    features: ['F012'],
    props: ['title', 'message', 'action'],
    states: ['plain', 'with-retry'],
    reusable: true,
    storyId: 'primitives-states--error',
  },
  {
    id: 'C014',
    name: 'SkeletonLines',
    source: 'apps/web/src/components/ui/primitives.tsx',
    category: 'Primitives',
    ownership: 'Primitive',
    purpose: 'Loading placeholder. Static bars, no shimmer — motion during loading is noise.',
    aliases: ['Skeleton', 'Loading', 'Shimmer', 'Placeholder', 'skeleton'],
    features: ['F012'],
    props: ['className'],
    states: ['default'],
    reusable: true,
    storyId: 'primitives-states--skeleton',
  },
  {
    id: 'C015',
    name: 'Stepper',
    source: 'apps/web/src/components/ui/primitives.tsx',
    category: 'Primitives',
    ownership: 'Primitive',
    purpose: 'Wizard progress bars. ⚠️ An out-of-range `current` fills every bar.',
    aliases: ['ProgressSteps', 'WizardProgress', 'StepIndicator', 'Progress'],
    features: ['F012'],
    props: ['steps', 'current'],
    states: ['0', '1', '2', '3', 'out-of-range', 'negative'],
    reusable: true,
    storyId: 'primitives-states--stepper-positions',
  },
  {
    id: 'C016',
    name: 'Field',
    source: 'apps/web/src/components/forms/field.tsx',
    category: 'Forms',
    ownership: 'Shared',
    purpose: 'Label + control + error. The accessibility contract every form inherits.',
    aliases: ['FormField', 'FormGroup', 'LabelledInput', 'FormRow', 'field'],
    features: ['F013'],
    props: ['id', 'label', 'hint', 'error', 'children'],
    states: ['plain', 'hint', 'error', 'hint+error'],
    reusable: true,
    storyId: 'forms-field',
  },
  {
    id: 'C017',
    name: 'Input',
    source: 'apps/web/src/components/ui/input.tsx',
    category: 'Forms',
    ownership: 'Primitive',
    purpose: 'The .input class as a component. NEW at F013 — see finding D-B.',
    aliases: ['TextInput', 'TextField', 'input', 'FormControl'],
    features: ['F013'],
    props: ['every input attribute', 'className'],
    states: ['default', 'placeholder', 'hover', 'focus', 'disabled', 'aria-invalid'],
    reusable: true,
    storyId: 'forms-field--every-control',
  },
  {
    id: 'C018',
    name: 'Textarea',
    source: 'apps/web/src/components/ui/input.tsx',
    category: 'Forms',
    ownership: 'Primitive',
    purpose: 'textarea.input — its own stylesheet rule, so its own component.',
    aliases: ['TextArea', 'MultilineInput', 'Description'],
    features: ['F013'],
    props: ['every textarea attribute', 'className'],
    states: ['default', 'disabled', 'aria-invalid'],
    reusable: true,
    storyId: 'forms-field--every-control',
  },
  {
    id: 'C019',
    name: 'Select',
    source: 'apps/web/src/components/ui/input.tsx',
    category: 'Forms',
    ownership: 'Primitive',
    purpose: 'select.input, with the custom chevron. Not a Combobox — no filtering.',
    aliases: ['Dropdown', 'Picker', 'NativeSelect', 'select'],
    features: ['F013'],
    props: ['every select attribute', 'className'],
    states: ['default', 'disabled', 'aria-invalid'],
    reusable: true,
    storyId: 'forms-field--every-control',
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
