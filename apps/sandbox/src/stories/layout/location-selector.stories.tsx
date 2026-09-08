import type { PublicLocations } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LocationSelector } from '@/components/layout/location-selector';

/**
 * DESIGN-SPEC §2.14 / §2.18 — the header's location button (C069), and the
 * dialog it opens.
 *
 * ## It lists districts, and that is the first interesting decision
 *
 * The baseline's version listed cities, off a five-row `cities` table that
 * **D6** removed. Districts is the better question at this level and would have
 * been even with the table: a district is the area somebody would drive across,
 * the towns inside it give no hint they are related — Arakkonam and Walajapet
 * share a district with Arcot and with nothing else — and a header dropdown
 * listing every town on the platform stops being readable at about thirty. The
 * towns are the directory's chips, narrowed to whatever is chosen here.
 *
 * ## And **R22** is the second: it is a dialog, grouped by state
 *
 * R19 restored the baseline's 220px panel and wrote down what it cost — "past
 * roughly fifteen districts the menu is taller than a short viewport". The
 * `ManyDistricts` story existed to make that visible. It turned out the height
 * was the smaller half of the problem: 38 districts in one flat column asks a
 * reader to already know which state each is in, and the reader who would ask
 * is exactly the one who does not.
 *
 * So: a centred dialog, and the hierarchy is the whole design.
 *
 *   · A **state** is a heading. Not focusable, no hover, no cursor change,
 *     nothing pressable about it — a state is not a place this product can be
 *     filtered to, and anything that looked clickable would be a dead end.
 *   · A **district** is a `<button>`, and the only selectable thing here.
 *   · The state row at the top **filters** and never selects. Press
 *     `Karnataka` and the Tamil Nadu block goes away; nobody's location changed.
 *
 * ## And **R23** is the third: the label, and who else opens it
 *
 * The button reads **`Select district`** until one is chosen, where it used to
 * read `All districts`. That was a true description of what is on screen and a
 * poor description of what the button is *for* — it stated a filter setting to
 * a first-time visitor who needed an invitation. `All districts` is not gone;
 * it is the dialog's footer button, where it is the way *back* and carries its
 * count.
 *
 * The dialog itself now lives in `DistrictPicker` (C071), because the directory
 * opens the same one from its own button. This component is the header's
 * trigger and nothing else.
 *
 * ## What to check by eye
 *
 *   · **Open it.** The trigger is the only thing rendered until you do.
 *   · **The plate on each state header** carries the RTO code — `TN`, `KA` —
 *     which is what those letters *are*: `TN 09 BX 4412` begins with them. A
 *     state the code map does not recognise renders without one; `Untidy` below
 *     is the story for that.
 *   · **It writes to the URL**, like every filter in the product — watch the
 *     router panel while choosing. Changing the district also *drops* `city`
 *     and `page`, because `?district=ranipet&city=katpadi` is an empty page.
 *   · **Selection is immediate.** Choosing pushes and closes; there is no
 *     confirm step, because there was not one before and this change is about
 *     the shape of the list, not the flow.
 *   · **Search never leaves a result ambiguous.** Type `ur` — every row names
 *     its state, because a flat list of `Tirupattur / Mysuru / Bengaluru Urban`
 *     with no states is the exact thing R22 removed.
 *   · **The shadow**, and the 7px corner. One of three elements in the product
 *     that carries one (§4.1), and the only radius above 4 (§4.3).
 *   · **Keyboard.** Enter or Space opens, focus lands inside, Tab is trapped,
 *     Escape closes and focus returns to the button. `Dialog` owns all of that.
 *   · **Mobile 375.** One column of districts, the search field under the
 *     title, and the footer still reachable. No horizontal scroll anywhere.
 */
const TAMIL_NADU: PublicLocations['districts'] = [
  { slug: 'chennai', name: 'Chennai', count: 48, state: 'Tamil Nadu' },
  { slug: 'coimbatore', name: 'Coimbatore', count: 31, state: 'Tamil Nadu' },
  { slug: 'madurai', name: 'Madurai', count: 22, state: 'Tamil Nadu' },
  { slug: 'tiruchirappalli', name: 'Tiruchirappalli', count: 18, state: 'Tamil Nadu' },
  { slug: 'salem', name: 'Salem', count: 16, state: 'Tamil Nadu' },
  { slug: 'vellore', name: 'Vellore', count: 11, state: 'Tamil Nadu' },
  { slug: 'ranipet', name: 'Ranipet', count: 11, state: 'Tamil Nadu' },
  { slug: 'erode', name: 'Erode', count: 10, state: 'Tamil Nadu' },
  { slug: 'tirupattur', name: 'Tirupattur', count: 8, state: 'Tamil Nadu' },
  { slug: 'thanjavur', name: 'Thanjavur', count: 8, state: 'Tamil Nadu' },
  { slug: 'kanchipuram', name: 'Kanchipuram', count: 7, state: 'Tamil Nadu' },
  { slug: 'chengalpattu', name: 'Chengalpattu', count: 6, state: 'Tamil Nadu' },
  { slug: 'tirunelveli', name: 'Tirunelveli', count: 4, state: 'Tamil Nadu' },
  { slug: 'thoothukudi', name: 'Thoothukudi', count: 2, state: 'Tamil Nadu' },
];

/** Where the platform is today: one state, so no state filter row is drawn. */
const ONE_STATE: PublicLocations = {
  districts: [
    { slug: 'vellore', name: 'Vellore', count: 11, state: 'Tamil Nadu' },
    { slug: 'ranipet', name: 'Ranipet', count: 11, state: 'Tamil Nadu' },
    { slug: 'tirupattur', name: 'Tirupattur', count: 8, state: 'Tamil Nadu' },
  ],
  total: 30,
};

const meta = {
  title: 'Layout/LocationSelector',
  component: LocationSelector,
  parameters: { layout: 'centered', nextjs: { appDirectory: true } },
  args: { locations: ONE_STATE },
} satisfies Meta<typeof LocationSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default, and today's real shape: three districts in one state.
 *
 * The state filter row is **absent**, on purpose. One state to move between is
 * not a choice; it is a control taking up room. It appears at two.
 */
export const Default: Story = {};

/**
 * A district chosen. Open it and Vellore is the cobalt row — border, `accent-100`
 * fill, cobalt label and a ✓, because status is never colour alone (§4.15).
 *
 * The footer names the pair — "Selected: Vellore, Tamil Nadu" — which is the
 * sentence this whole revision exists to be able to write, and the way back to
 * every district sits beside it carrying its own count.
 *
 * The story sets the URL through the Next router decorator rather than through
 * a prop, because the component reads `?district` and nothing else does.
 */
export const Chosen: Story = {
  parameters: {
    layout: 'centered',
    nextjs: { appDirectory: true, navigation: { query: { district: 'vellore' } } },
  },
};

/**
 * Four states — the platform after it spreads, and the case R22 was built for.
 *
 * This is the story to read the design off. Four headings, four plates, four
 * grids, and the state filter row at the top. Nothing about `Bengaluru Urban`
 * requires the reader to know it is in Karnataka; the heading above it says so.
 *
 * Press `Karnataka` in the filter row and watch what does **not** happen: the
 * router panel stays empty. Filtering is not selecting.
 */
export const ManyStates: Story = {
  args: {
    locations: {
      total: 268,
      districts: [
        ...TAMIL_NADU,
        { slug: 'bengaluru-urban', name: 'Bengaluru Urban', count: 27, state: 'Karnataka' },
        { slug: 'mysuru', name: 'Mysuru', count: 9, state: 'Karnataka' },
        { slug: 'dharwad', name: 'Dharwad', count: 5, state: 'Karnataka' },
        { slug: 'ernakulam', name: 'Ernakulam', count: 14, state: 'Kerala' },
        { slug: 'thrissur', name: 'Thrissur', count: 6, state: 'Kerala' },
        { slug: 'hyderabad', name: 'Hyderabad', count: 21, state: 'Telangana' },
        { slug: 'rangareddy', name: 'Rangareddy', count: 4, state: 'Telangana' },
      ],
    },
  },
};

/**
 * Fourteen districts in one state — what R19's `ManyDistricts` story showed as
 * a column running off the bottom of the screen.
 *
 * The comparison is the point of keeping it. Same data, and now it is a grid
 * inside a panel that scrolls, under a heading that says where it is.
 */
export const ManyDistricts: Story = {
  args: { locations: { total: 212, districts: TAMIL_NADU } },
};

/**
 * The data as it actually arrives sometimes: `state` is free text a dealership
 * typed, so it can be blank, and it can be a spelling the RTO-code map does not
 * know.
 *
 * Two things to check. `Goa` has no plate rather than a guessed one — a wrong
 * two-letter code on something shaped like a number plate is worse than none.
 * And the districts with no state at all group under **State not recorded**,
 * which sorts last however big it is: it is a heading explaining an absence,
 * and an absence does not lead.
 */
export const Untidy: Story = {
  args: {
    locations: {
      total: 40,
      districts: [
        { slug: 'vellore', name: 'Vellore', count: 11, state: 'Tamil Nadu' },
        { slug: 'ranipet', name: 'Ranipet', count: 9, state: 'Tamil Nadu' },
        { slug: 'north-goa', name: 'North Goa', count: 6, state: 'Goaa' },
        { slug: 'somewhere', name: 'Somewhere', count: 8, state: null },
        { slug: 'elsewhere', name: 'Elsewhere', count: 6, state: null },
      ],
    },
  },
};

/**
 * The empty case, and it is not hypothetical: the public layout catches a
 * failed `/v1/locations` and degrades to this rather than letting a throw take
 * the whole document to `global-error`. The button must still be a button, the
 * dialog must still open, and it must say what is going on rather than showing
 * an empty white box.
 */
export const NoDistricts: Story = { args: { locations: { districts: [], total: 0 } } };
