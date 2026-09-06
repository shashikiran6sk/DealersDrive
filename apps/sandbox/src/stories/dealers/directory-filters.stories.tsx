import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DirectoryFilters } from '@/components/dealers/directory-filters';

/**
 * DESIGN-SPEC §3.5 — the directory's name search and city chips (C031).
 *
 * **It writes to the URL, not to a state store.** That is the rule every filter
 * in the product follows (ARCHITECTURE §15.2): `/dealers?city=vellore` is
 * shareable, server-renderable, and survives a back button. Watch the router
 * panel in the Storybook addons while clicking a chip — the push it makes *is*
 * the component's output.
 *
 * Two behaviours worth checking by eye:
 *
 *   · **The chips are toggles.** Pressing the one that is already on clears the
 *     filter. That is the only affordance for getting back to every city
 *     without reaching for the browser's back button, and `aria-pressed` says
 *     so to a screen reader.
 *   · **A search and a city compose.** Typing a name with a chip already on
 *     keeps the chip; the query string carries both.
 *
 * The chips come from the API, counted over every ACTIVE dealership rather than
 * over the filtered page — so choosing one cannot empty the row it was chosen
 * from. `Filtered` below is what that looks like: Vellore is pressed, and
 * Katpadi is still there to switch to.
 */
const CITIES = [
  { slug: 'vellore', name: 'Vellore', count: 12 },
  { slug: 'katpadi', name: 'Katpadi', count: 7 },
  { slug: 'gudiyatham', name: 'Gudiyatham', count: 2 },
  { slug: 'arakkonam', name: 'Arakkonam', count: 1 },
];

const meta = {
  title: 'Dealers/DirectoryFilters',
  component: DirectoryFilters,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ width: 900 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DirectoryFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing chosen: the unfiltered `/dealers`. */
export const Default: Story = { args: { cities: CITIES } };

/** A city chosen. Every other chip stays available. */
export const Filtered: Story = { args: { cities: CITIES, city: 'vellore' } };

/** A search in progress, restored from the URL rather than from memory. */
export const Searching: Story = { args: { cities: CITIES, q: 'lakshmi' } };

/** Both at once — the query string carries `?city=vellore&q=lakshmi`. */
export const SearchWithinACity: Story = {
  args: { cities: CITIES, city: 'vellore', q: 'lakshmi' },
};

/**
 * One city. This is the shape of the directory early on, and the row has to not
 * look broken with a single chip in it.
 */
export const OneCity: Story = { args: { cities: CITIES.slice(0, 1) } };

/**
 * No chips at all — every dealership so far left the locality blank, so there
 * is nothing truthful to offer. The search box stands alone rather than being
 * joined by an empty row.
 */
export const NoCities: Story = { args: { cities: [] } };

/**
 * Twelve cities. The row wraps rather than scrolling, which is what keeps every
 * chip reachable by keyboard in document order.
 */
export const ManyCities: Story = {
  args: {
    cities: [
      ...CITIES,
      { slug: 'ranipet', name: 'Ranipet', count: 6 },
      { slug: 'ambur', name: 'Ambur', count: 5 },
      { slug: 'vaniyambadi', name: 'Vaniyambadi', count: 4 },
      { slug: 'tiruvannamalai', name: 'Tiruvannamalai', count: 4 },
      { slug: 'kanchipuram', name: 'Kanchipuram', count: 3 },
      { slug: 'chengalpattu', name: 'Chengalpattu', count: 3 },
      { slug: 'thiruvallur', name: 'Thiruvallur', count: 2 },
      { slug: 'sriperumbudur', name: 'Sriperumbudur', count: 1 },
    ],
  },
};
