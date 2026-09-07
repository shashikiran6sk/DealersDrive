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
 * Three behaviours worth checking by eye:
 *
 *   · **The chips are multi-select toggles.** Pressing a second one adds it
 *     rather than replacing the first — a buyer working the Vellore belt wants
 *     Katpadi *and* Vellore, twenty minutes apart. `aria-pressed` already said
 *     "toggle"; this is the behaviour matching the announcement.
 *   · **There is one way out.** With one chip at a time, pressing the active
 *     one cleared the filter and that was discoverable enough. With several on,
 *     un-pressing each in turn is not — hence the counted "Clear N towns".
 *   · **A search and a town compose**, and so does a district. The query string
 *     carries all three.
 *
 * The chips come from the API, narrowed to the district the header selected and
 * counted over it rather than over the page — so choosing one cannot empty the
 * row it was chosen from. `OneTown` below is what that looks like: Vellore is
 * pressed, and Katpadi is still there to add.
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

/** One town chosen. Every other chip stays available, and so does the clear. */
export const OneTown: Story = { args: { cities: CITIES, city: ['vellore'] } };

/**
 * Two towns at once — the case single-select could not express, and the reason
 * the chips changed. The pill count in "Clear 2 towns" is what makes the size
 * of the selection legible without counting the highlighted chips.
 */
export const SeveralTowns: Story = {
  args: { cities: CITIES, city: ['vellore', 'katpadi'] },
};

/** A search in progress, restored from the URL rather than from memory. */
export const Searching: Story = { args: { cities: CITIES, q: 'lakshmi' } };

/** Both at once — the query string carries `?city=vellore&q=lakshmi`. */
export const SearchWithinACity: Story = {
  args: { cities: CITIES, city: ['vellore'], q: 'lakshmi' },
};

/**
 * Inside a district, which is the header's doing. The chips are the towns in
 * it; this component only carries the district through every navigation it
 * makes — drop it and choosing a town would silently widen the search back to
 * the whole platform.
 */
export const WithinADistrict: Story = {
  args: { cities: CITIES.slice(0, 3), district: 'vellore', city: ['katpadi'] },
};

/**
 * One city on the platform. This is the shape of the directory early on, and
 * the row has to not look broken with a single chip in it.
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
