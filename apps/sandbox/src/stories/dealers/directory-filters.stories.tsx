import type { PublicLocations } from '@dealers-drive/contracts';
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
 *
 * ## The row has two shapes as of R23
 *
 * Compare **`Default`** with **`WithinADistrict`**, which is the whole of the
 * revision. With no district, `cities` is every town *on the platform* — the
 * old `ManyCities` story was four rows of them and that was at a fraction of
 * the real number — so the row becomes a single `Select district` button and
 * the chips wait until a district makes them a readable set.
 *
 * The grid underneath does not change: no district still means every
 * dealership. This narrows the control, not the results.
 *
 * **`AppliedTownWithoutADistrict`** is the case that stops this being a plain
 * "hide the chips" rule. `indexPolicy` names `/dealers?city=vellore` an
 * indexable canonical, so a buyer can arrive there from a search result with a
 * town already applied and no district — and a row that hid itself would leave
 * them a filter they can neither see nor clear. An applied town always shows.
 */
const LOCATIONS: PublicLocations = {
  districts: [
    { slug: 'vellore', name: 'Vellore', count: 11, state: 'Tamil Nadu' },
    { slug: 'ranipet', name: 'Ranipet', count: 11, state: 'Tamil Nadu' },
    { slug: 'tirupattur', name: 'Tirupattur', count: 8, state: 'Tamil Nadu' },
    { slug: 'mysuru', name: 'Mysuru', count: 11, state: 'Karnataka' },
    { slug: 'bengaluru-urban', name: 'Bengaluru Urban', count: 11, state: 'Karnataka' },
    { slug: 'ernakulam', name: 'Ernakulam', count: 11, state: 'Kerala' },
    { slug: 'kozhikode', name: 'Kozhikode', count: 8, state: 'Kerala' },
  ],
  total: 120,
};

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

/**
 * Nothing chosen: the unfiltered `/dealers`, and **R23's headline change**.
 *
 * `cities` here is the full platform list, exactly as the API returns it with
 * no district — and none of it renders. The button and one line of prose stand
 * in its place. Open the picker and choose Vellore to reach `WithinADistrict`.
 */
export const Default: Story = { args: { cities: CITIES, locations: LOCATIONS } };

/**
 * A town applied with no district — `/dealers?city=vellore`, which the SEO
 * policy invites Google to send people to.
 *
 * Vellore is pressed and `Clear town` is beside it; Katpadi and the rest are
 * not, because they are still the platform's whole list. Seeing what is applied
 * is a different need from browsing what could be.
 */
export const AppliedTownWithoutADistrict: Story = {
  args: { cities: CITIES, city: ['vellore'], locations: LOCATIONS },
};

/** One town chosen. Every other chip stays available, and so does the clear. */
export const OneTown: Story = {
  args: { cities: CITIES, city: ['vellore'], district: 'vellore', locations: LOCATIONS },
};

/**
 * Two towns at once — the case single-select could not express, and the reason
 * the chips changed. The pill count in "Clear 2 towns" is what makes the size
 * of the selection legible without counting the highlighted chips.
 */
export const SeveralTowns: Story = {
  args: {
    cities: CITIES,
    city: ['vellore', 'katpadi'],
    district: 'vellore',
    locations: LOCATIONS,
  },
};

/** A search in progress, restored from the URL rather than from memory. */
export const Searching: Story = {
  args: { cities: CITIES, q: 'lakshmi', district: 'vellore', locations: LOCATIONS },
};

/** Both at once — the query string carries `?city=vellore&q=lakshmi`. */
export const SearchWithinACity: Story = {
  args: {
    cities: CITIES,
    city: ['vellore'],
    q: 'lakshmi',
    district: 'vellore',
    locations: LOCATIONS,
  },
};

/**
 * Inside a district, which is the header's doing. The chips are the towns in
 * it; this component only carries the district through every navigation it
 * makes — drop it and choosing a town would silently widen the search back to
 * the whole platform.
 */
export const WithinADistrict: Story = {
  args: {
    cities: CITIES.slice(0, 3),
    district: 'vellore',
    city: ['katpadi'],
    locations: LOCATIONS,
  },
};

/**
 * One town in the district. This is the shape of a district early on, and the
 * row has to not look broken with a single chip in it.
 */
export const OneCity: Story = {
  args: { cities: CITIES.slice(0, 1), district: 'vellore', locations: LOCATIONS },
};

/**
 * No chips at all — every dealership in the district left the locality blank,
 * so there is nothing truthful to offer. The search box stands alone rather
 * than being joined by an empty row.
 */
export const NoCities: Story = {
  args: { cities: [], district: 'vellore', locations: LOCATIONS },
};

/**
 * Twelve towns **inside one district**. The row wraps rather than scrolling,
 * which is what keeps every chip reachable by keyboard in document order.
 *
 * This is what the row is allowed to look like now. Before R23 the same wrap
 * happened with no district at all and with every town on the platform in it,
 * which is the state `Default` replaces — twelve is a big district, forty-four
 * was a wall.
 */
export const ManyCities: Story = {
  args: {
    district: 'vellore',
    locations: LOCATIONS,
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
