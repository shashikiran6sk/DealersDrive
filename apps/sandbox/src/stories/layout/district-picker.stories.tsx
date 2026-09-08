import type { PublicLocations } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DistrictPicker } from '@/components/layout/district-picker';

/**
 * The district dialog itself (C071), and the one rule for applying a district.
 *
 * ## Why it is a component and not part of the header
 *
 * R22 built this inside `LocationSelector`, which was right while the header
 * was the only thing that opened one. **R23 gave the directory a second
 * opener**: with no district chosen, `DirectoryFilters` was rendering every
 * town on the platform as chips — forty-four of them at 120 dealerships, worse
 * with every signup — so the row became a `Select district` button instead.
 *
 * Two openers is the moment the dialog stops belonging to the header. What is
 * shared is not only the markup but the **selection rule**: drop `city` and
 * `page`, go to `/dealers` from anywhere else. A second copy of that rule is
 * how the header and the directory would come to disagree about what choosing
 * a district means — so `useDistrictSelection` is exported beside the component
 * and a third opener inherits it rather than restating it.
 *
 * The trigger is a **render prop**, given whichever district is in the URL. The
 * two callers say different things about the same state: the header names the
 * chosen district, and the directory's button exists precisely when there is
 * none. `HeaderTrigger` and `DirectoryTrigger` below are those two, verbatim.
 *
 * Everything about the dialog's own design — states as headings, districts as
 * buttons, the state filter that never selects, the flat search list where
 * every row names its state — is R22's and is documented on
 * `Layout/LocationSelector`, which is the same dialog behind the header's
 * button. This file is about the sharing.
 */
const FOUR_STATES: PublicLocations = {
  districts: [
    { slug: 'vellore', name: 'Vellore', count: 11, state: 'Tamil Nadu' },
    { slug: 'ranipet', name: 'Ranipet', count: 11, state: 'Tamil Nadu' },
    { slug: 'tirupattur', name: 'Tirupattur', count: 8, state: 'Tamil Nadu' },
    { slug: 'bengaluru-urban', name: 'Bengaluru Urban', count: 11, state: 'Karnataka' },
    { slug: 'mysuru', name: 'Mysuru', count: 11, state: 'Karnataka' },
    { slug: 'belagavi', name: 'Belagavi', count: 8, state: 'Karnataka' },
    { slug: 'visakhapatnam', name: 'Visakhapatnam', count: 11, state: 'Andhra Pradesh' },
    { slug: 'guntur', name: 'Guntur', count: 11, state: 'Andhra Pradesh' },
    { slug: 'kurnool', name: 'Kurnool', count: 8, state: 'Andhra Pradesh' },
    { slug: 'ernakulam', name: 'Ernakulam', count: 11, state: 'Kerala' },
    { slug: 'thrissur', name: 'Thrissur', count: 11, state: 'Kerala' },
    { slug: 'kozhikode', name: 'Kozhikode', count: 8, state: 'Kerala' },
  ],
  total: 120,
};

const meta = {
  title: 'Layout/DistrictPicker',
  component: DistrictPicker,
  parameters: { layout: 'centered', nextjs: { appDirectory: true } },
  args: { locations: FOUR_STATES },
} satisfies Meta<typeof DistrictPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The header's trigger — `LocationSelector`'s, exactly.
 *
 * It names the chosen district, and reads **`Select district`** when there is
 * none. That label is R23's: `All districts` was a true description of what is
 * on screen and a poor description of what the button is for.
 *
 * This is the seeded dev database's real geography — twelve districts across
 * four states, 120 dealerships — so the state filter row and the grouping are
 * both doing work rather than being demonstrated on two rows.
 */
export const HeaderTrigger: Story = {
  args: {
    children: (chosen) => (
      <button type="button" className="btn btn-secondary flex items-center gap-[7px]">
        <span className="block h-[14px] w-[5px] bg-(--color-accent)" aria-hidden="true" />
        {chosen?.name ?? 'Select district'} <span aria-hidden="true">▾</span>
      </button>
    ),
  },
};

/**
 * The directory's trigger — `DirectoryFilters`', exactly.
 *
 * Same dialog, same selection rule, different button. It never names a chosen
 * district because it is only rendered when there is not one: inside a district
 * the row is the towns in it, and the header keeps the way to change it.
 */
export const DirectoryTrigger: Story = {
  args: {
    children: () => (
      <button type="button" className="btn btn-secondary flex items-center gap-[7px]">
        <span className="block h-[14px] w-[5px] bg-(--color-accent)" aria-hidden="true" />
        Select district
      </button>
    ),
  },
};

/**
 * A district already chosen, through the header's trigger.
 *
 * Two things to look at. The trigger names it rather than saying `Select
 * district` — the render prop is handed the district the URL carries. And
 * inside, `All districts` in the footer is enabled and carries the platform's
 * count: it is the way back, which is the role that label kept at R23.
 *
 * The story sets the URL through the Next router decorator rather than through
 * a prop, because the component reads `?district` and nothing else does.
 */
export const OneChosen: Story = {
  args: HeaderTrigger.args,
  parameters: {
    layout: 'centered',
    nextjs: { appDirectory: true, navigation: { query: { district: 'kozhikode' } } },
  },
};

/**
 * The empty case, and it is not hypothetical: `getPublicLocations` catches a
 * failed `/v1/locations` and degrades to this rather than letting a throw take
 * the whole document to `global-error`.
 *
 * Both triggers must still be buttons, the dialog must still open, and it must
 * say what is going on rather than showing an empty white box.
 */
export const NoDistricts: Story = {
  args: { ...HeaderTrigger.args, locations: { districts: [], total: 0 } },
};
