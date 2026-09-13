import type { DealerSuggestResponse } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect } from 'react';
import { fn } from 'storybook/test';

import { DealerSearchBox } from '@/components/dealers/dealer-search-box';

/**
 * DESIGN-SPEC §3.5 and `docs/Dealers-Drive-UI/Search-Bar` — the directory's
 * search box, with recommendations (C074, **R43**).
 *
 * The interaction underneath it is `AutocompletePanel` (C073), which knows
 * nothing about dealerships: **verifying it here verifies the control the
 * vehicle search at F077 is meant to reuse**, which is why there is no second
 * story file for the generic half.
 *
 * ## What to check by eye
 *
 *   · **Type slowly, then fast.** The network panel shows one request per
 *     *pause*, not one per keystroke. Seven characters typed in one go is one
 *     request — that is the 300 ms debounce, and it is the whole reason this
 *     control does not hammer the endpoint.
 *   · **The first row is highlighted before you touch anything.** Press Enter
 *     without arrowing: it searches for that row. The `Select ↵` chip on the
 *     highlighted row is the only affordance that says so, and it is on the row
 *     Enter would actually take.
 *   · **↑ and ↓ wrap.** Arrow up from the first row to reach the last one.
 *   · **The typed characters are marked**, in every position they occur — see
 *     "Honest Wheels **Vel**lore", matched in the middle of the name.
 *   · **`MatchedOnAPlace`** is the case a client-side highlighter gets wrong:
 *     the dealership is offered because its *town* matched, so the name carries
 *     none of the typed characters and the meta line is what is marked. The
 *     server says which field earned the row; the client does not guess.
 *
 * ## The three states that are not a list
 *
 * `Loading`, `NothingFound` and `EndpointFailed` are separate stories because
 * they are three different sentences, and collapsing any two of them lies to
 * somebody. "No dealerships match" shown while the request is still in flight
 * is the most common version of that lie, and `Loading` is what proves this
 * control does not tell it.
 *
 * ## `onSearch`, not a navigation
 *
 * The box does not own the URL — `DirectoryFilters` does. Watch the Actions
 * panel: choosing a row calls `onSearch` with the dealership's **exact trading
 * name**, which is what `?q=` matches on, and the ✕ calls it with `null`.
 */

const YARDS: DealerSuggestResponse['data'] = [
  {
    slug: 'vellore-cars',
    brandName: 'Vellore Cars',
    initials: 'VC',
    metaLabel: '42 cars in yard · Katpadi, Vellore',
    matchedOn: 'brandName',
    carCount: 42,
    isVerified: true,
  },
  {
    slug: 'vellore-star-auto-yards',
    brandName: 'Vellore Star Auto Yards',
    initials: 'VS',
    metaLabel: '18 cars in yard · Gandhi Nagar, Vellore',
    matchedOn: 'brandName',
    carCount: 18,
    isVerified: true,
  },
  {
    slug: 'royal-vellore-motors',
    brandName: 'Royal Vellore Motors',
    initials: 'RV',
    metaLabel: '29 cars in yard · Arcot Road, Vellore',
    matchedOn: 'brandName',
    carCount: 29,
    isVerified: true,
  },
  {
    slug: 'honest-wheels-vellore',
    brandName: 'Honest Wheels Vellore',
    initials: 'HW',
    metaLabel: '31 cars in yard · Bagayam, Vellore',
    matchedOn: 'brandName',
    carCount: 31,
    isVerified: true,
  },
];

const BY_PLACE: DealerSuggestResponse['data'] = [
  {
    slug: 'anand-motors',
    brandName: 'Anand Motors',
    initials: 'AM',
    metaLabel: '12 cars in yard · Katpadi, Vellore',
    matchedOn: 'city',
    carCount: 12,
    isVerified: true,
  },
  {
    slug: 'sri-lakshmi-motors',
    brandName: 'Sri Lakshmi Motors',
    initials: 'SL',
    metaLabel: '7 cars in yard · Katpadi, Vellore',
    matchedOn: 'city',
    carCount: 7,
    isVerified: true,
  },
];

type Behaviour =
  | { kind: 'rows'; rows: DealerSuggestResponse['data']; delayMs?: number }
  | { kind: 'empty' }
  | { kind: 'never' }
  | { kind: 'fails' };

/**
 * A fake `/api/search/dealers`, installed for the life of the story.
 *
 * The sandbox has no Next server behind it, so the box would see a 404 and sit
 * permanently in its error state — which would make four of the six stories
 * below untestable by eye. This is the endpoint, not a stand-in for the
 * component: everything about the debounce, the abort and the stale guard is
 * still the real implementation talking to a real `fetch`.
 */
function useFakeSuggestEndpoint(behaviour: Behaviour): void {
  useEffect(() => {
    // Bound, so the saved reference is still callable as `window.fetch` — an
    // unbound `fetch` throws `Illegal invocation` in the browser.
    const real = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (!url.includes('/api/search/dealers')) return real(input, init);

      const search = new URL(url, window.location.origin).searchParams.get('search') ?? '';

      if (behaviour.kind === 'fails') {
        return Promise.resolve(new Response('{}', { status: 502 }));
      }
      if (behaviour.kind === 'never') {
        // Never settles, so `Loading` can be looked at rather than glimpsed.
        return new Promise<Response>(() => undefined);
      }

      const rows =
        behaviour.kind === 'empty'
          ? []
          : behaviour.rows.filter((row) =>
              `${row.brandName} ${row.metaLabel}`.toLowerCase().includes(search.toLowerCase()),
            );

      const payload: DealerSuggestResponse = {
        // Echoed back, exactly as the API does — it is what the stale guard
        // compares against, so a fake that skipped it would fake the bug away.
        search,
        data: rows,
        countLabel: `${String(rows.length)} matching ${rows.length === 1 ? 'yard' : 'yards'}`,
      };

      return new Promise<Response>((resolve) => {
        setTimeout(
          () => resolve(new Response(JSON.stringify(payload), { status: 200 })),
          behaviour.kind === 'rows' ? (behaviour.delayMs ?? 120) : 0,
        );
      });
    };

    return () => {
      window.fetch = real;
    };
  }, [behaviour]);
}

function Harness({
  behaviour,
  ...props
}: { behaviour: Behaviour } & Parameters<typeof DealerSearchBox>[0]) {
  useFakeSuggestEndpoint(behaviour);
  return <DealerSearchBox {...props} />;
}

const meta = {
  title: 'Search/DealerSearchBox',
  component: Harness,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  argTypes: {
    behaviour: { table: { disable: true } },
  },
  args: {
    behaviour: { kind: 'rows', rows: YARDS },
    districtName: 'Vellore',
    district: 'vellore',
    // The box does not own the URL. Watch the Actions panel: a chosen row calls
    // this with the dealership's exact trading name, and the ✕ with `null`.
    onSearch: fn(),
  },
  decorators: [
    (Story) => (
      // Room below the box, so the panel is not clipped by the canvas.
      <div style={{ width: 560, paddingBottom: 340 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The empty box. **Type `vel`** — after a pause the four yards appear with the
 * first one highlighted, and Enter searches for it.
 */
export const Default: Story = {};

/**
 * The same, with no district chosen. The heading reads "Dealerships" rather
 * than naming a district, and the placeholder loses the place — `/dealers` with
 * no filter is every dealership on the platform, and the box should not imply
 * otherwise.
 */
export const NoDistrict: Story = {
  args: { district: undefined, districtName: undefined },
};

/**
 * A search already applied, restored from the URL rather than from memory —
 * `/dealers?q=Vellore+Cars`. The ✕ clears it, and calls `onSearch(null)`.
 */
export const SearchAlreadyApplied: Story = {
  args: { q: 'Vellore Cars' },
};

/**
 * Matched on the **town**, not the name (type `katpadi`).
 *
 * Neither name contains the typed characters, so nothing in them is marked and
 * the meta line carries the mark instead. A client that searched the name for
 * what was typed would underline nothing while still claiming a match.
 */
export const MatchedOnAPlace: Story = {
  args: { behaviour: { kind: 'rows', rows: BY_PLACE } },
};

/**
 * The request is in flight and nothing has come back. **"Searching…", never
 * "no dealerships match"** — the second is a claim about the platform, and it
 * is not one this control is entitled to make yet.
 */
export const Loading: Story = {
  args: { behaviour: { kind: 'never' } },
};

/** Nothing matched. It names what was searched for, so the buyer can see the typo. */
export const NothingFound: Story = {
  args: { behaviour: { kind: 'empty' } },
};

/**
 * The endpoint is down. The box degrades to a line and says the search still
 * works — which is true: the grid behind it was server-rendered from a
 * different call and is untouched.
 */
export const EndpointFailed: Story = {
  args: { behaviour: { kind: 'fails' } },
};

/**
 * A slow endpoint — 1.2 s per answer. Type quickly and watch the panel: the
 * answers to the shorter queries are dropped rather than rendered, because each
 * one carries the search it answered and only the current one is kept.
 */
export const SlowEndpoint: Story = {
  args: { behaviour: { kind: 'rows', rows: YARDS, delayMs: 1200 } },
};
