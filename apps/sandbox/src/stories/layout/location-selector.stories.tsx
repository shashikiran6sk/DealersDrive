import type { PublicLocations } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LocationSelector } from '@/components/layout/location-selector';

/**
 * DESIGN-SPEC §2.18 — the header's location button (C069).
 *
 * ## It lists districts, and that is the interesting decision
 *
 * The baseline's version listed cities, off a five-row `cities` table that
 * **D6** removed. Districts is the better question at this level and would have
 * been even with the table: a district is the area somebody would drive across,
 * the towns inside it give no hint they are related — Arakkonam and Walajapet
 * share a district with Arcot and with nothing else — and a header dropdown
 * listing every town on the platform stops being readable at about thirty. The
 * towns are the directory's chips, narrowed to whatever is chosen here.
 *
 * ## What to check by eye
 *
 *   · **It writes to the URL**, like every filter in the product — watch the
 *     router panel while choosing. Changing the district also *drops* `city`
 *     and `page`, because `?district=ranipet&city=katpadi` is an empty page.
 *   · **The shadow.** One of three elements in the product that carries one.
 *   · **"All districts" carries its own count**, so the way back is a fact
 *     rather than an escape hatch with a blank beside it.
 *   · **Keyboard.** Enter or Space opens, Escape closes and returns focus to
 *     the button, an outside click closes it.
 */
const LOCATIONS: PublicLocations = {
  districts: [
    { slug: 'vellore', name: 'Vellore', count: 11 },
    { slug: 'ranipet', name: 'Ranipet', count: 11 },
    { slug: 'tirupattur', name: 'Tirupattur', count: 8 },
  ],
  total: 30,
};

const meta = {
  title: 'Layout/LocationSelector',
  component: LocationSelector,
  parameters: { layout: 'centered', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      // Room for the menu, which is absolutely positioned under the button.
      <div style={{ width: 320, height: 260, display: 'flex', justifyContent: 'flex-end' }}>
        <Story />
      </div>
    ),
  ],
  args: { locations: LOCATIONS },
} satisfies Meta<typeof LocationSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing chosen. The button reads "All districts", which is the truth. */
export const Default: Story = {};

/**
 * The empty case, and it is not hypothetical: the public layout catches a
 * failed `/v1/locations` and degrades to this rather than letting a throw take
 * the whole document to `global-error`. The button must still be a button, and
 * "All districts" must still be there to press.
 */
export const NoDistricts: Story = { args: { locations: { districts: [], total: 0 } } };

/**
 * Fourteen districts — a state the platform reaches by expanding, not by being
 * mis-seeded. The menu scrolls at 60vh rather than growing past the fold, which
 * is the thing to check here.
 */
export const ManyDistricts: Story = {
  args: {
    locations: {
      total: 212,
      districts: [
        { slug: 'chennai', name: 'Chennai', count: 48 },
        { slug: 'coimbatore', name: 'Coimbatore', count: 31 },
        { slug: 'madurai', name: 'Madurai', count: 22 },
        { slug: 'tiruchirappalli', name: 'Tiruchirappalli', count: 18 },
        { slug: 'salem', name: 'Salem', count: 16 },
        { slug: 'vellore', name: 'Vellore', count: 11 },
        { slug: 'ranipet', name: 'Ranipet', count: 11 },
        { slug: 'erode', name: 'Erode', count: 10 },
        { slug: 'tirupattur', name: 'Tirupattur', count: 8 },
        { slug: 'thanjavur', name: 'Thanjavur', count: 8 },
        { slug: 'kanchipuram', name: 'Kanchipuram', count: 7 },
        { slug: 'chengalpattu', name: 'Chengalpattu', count: 6 },
        { slug: 'tirunelveli', name: 'Tirunelveli', count: 4 },
        { slug: 'thoothukudi', name: 'Thoothukudi', count: 2 },
      ],
    },
  },
};
