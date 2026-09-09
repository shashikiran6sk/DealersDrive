import type { DealerCard, PublicLocations } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { navigationState } from '../../../setup';

import { DirectoryCard } from '@/components/dealers/dealer-card';
import { DirectoryFilters } from '@/components/dealers/directory-filters';
import { indexPolicy } from '@/lib/seo';

/**
 * The directory's two components, and the indexing policy behind the page.
 *
 * What is asserted is the behaviour that outlives a restyle: where the card's
 * one link goes, what the filters push onto the URL, and which of those URLs a
 * crawler is invited to index. Nothing here pins the 128px cover or the 24px
 * overhang — that is what the sandbox is for.
 */
const DEALER: DealerCard = {
  slug: 'sri-lakshmi-motors',
  brandName: 'Sri Lakshmi Motors',
  initials: 'SL',
  city: 'Vellore',
  state: 'Tamil Nadu',
  yearsOperating: 17,
  yearsLabel: 'Vellore, Tamil Nadu · 17 years',
  tagline: 'Hatchbacks under ₹6 lakh',
  services: ['Hatchbacks', 'RC transfer', 'Exchange'],
  carCount: 7,
  fromPricePaise: 22_500_00,
  fromPriceLabel: 'from ₹2.25 Lakh',
  isVerified: true,
  logoUrl: null,
  coverUrl: null,
};

describe('DirectoryCard', () => {
  /**
   * The heading's anchor is stretched over the whole card, and "View inventory"
   * is a lifted affordance rather than a second anchor — a nested link would be
   * invalid HTML and would announce the same destination twice.
   */
  it('is one link to the portfolio, not two', () => {
    render(<DirectoryCard dealer={DEALER} />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/dealers/sri-lakshmi-motors');
    expect(links[0]).toHaveTextContent('Sri Lakshmi Motors');
  });

  it('renders the API-composed strings rather than recomposing them', () => {
    render(<DirectoryCard dealer={DEALER} />);

    expect(screen.getByText('Vellore, Tamil Nadu · 17 years')).toBeInTheDocument();
    expect(screen.getByText('from ₹2.25 Lakh')).toBeInTheDocument();
  });

  /** The state every dealership is in until F064 puts a listing on the platform. */
  it('shows a dealership with no live cars rather than hiding it', () => {
    render(
      <DirectoryCard
        dealer={{ ...DEALER, carCount: 0, fromPricePaise: null, fromPriceLabel: '—' }}
      />,
    );

    expect(screen.getByText('0 cars listed')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('says "1 car listed", not "1 cars listed"', () => {
    render(<DirectoryCard dealer={{ ...DEALER, carCount: 1 }} />);

    expect(screen.getByText('1 car listed')).toBeInTheDocument();
  });

  it('shows at most three services even if handed more', () => {
    render(<DirectoryCard dealer={{ ...DEALER, services: ['A', 'B', 'C', 'D', 'E'] }} />);

    expect(screen.queryByText('D')).toBeNull();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('drops the tagline and the service row entirely when there are none', () => {
    render(<DirectoryCard dealer={{ ...DEALER, tagline: null, services: [] }} />);

    expect(screen.queryByText(/hatchbacks under/i)).toBeNull();
    expect(screen.queryByText('RC transfer')).toBeNull();
  });

  /**
   * R21 — and dropping them does not change the card's height, because the
   * height is a constant rather than a floor or a shared maximum.
   *
   * R17 asserted a `min-h` and left `grid-auto-rows: 1fr` to make the cards
   * agree with each other. They did agree — on the tallest card's height, so
   * one dealership writing a longer tagline still grew every card on the page.
   * What is asserted now is that the *same* height class is on the card in
   * every data state; jsdom computes no layout, so the sandbox's
   * `SameDataTwice` is what measures the result (424px, both grids).
   */
  const heightOf = (dealer: DealerCard): string =>
    render(<DirectoryCard dealer={dealer} />).container.querySelector('article')?.className ?? '';

  it('is the same fixed height with nothing filled in and with everything', () => {
    const sparse = heightOf({ ...DEALER, tagline: null, services: [] });
    const full = heightOf({
      ...DEALER,
      tagline: 'A'.repeat(200),
      services: ['In-house workshop', 'RC transfer assistance', 'Bank loan tie-ups'],
    });

    expect(sparse).toContain('h-[424px]');
    expect(full).toContain('h-[424px]');
    // And no floor left behind to imply the height is negotiable.
    expect(sparse).not.toContain('min-h-');
  });

  /**
   * The three bounds that let a constant height hold. Each one is the largest
   * variable in its row of the card, and each is checked where it is applied
   * rather than through a rendered pixel jsdom does not compute.
   */
  it('clamps the name, clamps the tagline, and clips the prose box', () => {
    const { container } = render(
      <DirectoryCard dealer={{ ...DEALER, brandName: 'Sri Venkateswara '.repeat(4) }} />,
    );

    expect(container.querySelector('h3')?.className).toContain('line-clamp-2');
    expect(container.querySelector('[data-slot="prose"] p')?.className).toContain('line-clamp-2');
    // `min-h-0` is what lets the box clip instead of pushing the footer down.
    // Selected by slot rather than by `.overflow-hidden`: R28 put that class on
    // the article as well, so the bare selector now matches the card first.
    const box = container.querySelector('[data-slot="prose"]');
    expect(box?.className).toContain('min-h-0');
    expect(box?.className).toContain('flex-1');
  });

  /**
   * R24, kept — and **R28**, which retired the way it was fixed.
   *
   * The reported bug was a logo tile that slid down the card when the
   * dealership's name wrapped to two lines: the tile shared a flex row with the
   * heading and was bottom-aligned to it, so the name's own height set where
   * the tile landed. R24 pinned the row to `items-start`.
   *
   * R28 took the tile out of that row altogether. It sits with the VERIFIED
   * DEALER plate in a row of their own, straddling the cover's bottom edge, and
   * the name begins underneath both — so the tile is positioned against the
   * *cover* and there is no longer any path by which a name can move it. That
   * is what is asserted, because it is the property that makes the bug
   * unavailable rather than merely corrected: **the tile and the heading are
   * not in the same row.**
   */
  it('positions the logo tile against the cover, not against the name', () => {
    const { container } = render(
      <DirectoryCard dealer={{ ...DEALER, brandName: 'Sri Venkateswara '.repeat(4) }} />,
    );

    const tile = container.querySelector('span[aria-hidden="true"]');
    const row = tile?.parentElement;

    expect(row).not.toBeNull();
    // Nothing in the tile's row varies with the dealership's data, so nothing
    // in it can push the tile anywhere.
    expect(row?.querySelector('h3')).toBeNull();
    expect(container.querySelector('h3')).not.toBeNull();
    // And the row is pulled up over the cover by half the tile, which is the
    // straddle itself rather than a decoration on top of it.
    expect(row?.getAttribute('style')).toContain('-24px');
  });

  it('names the missing photograph rather than showing a blank frame', () => {
    render(<DirectoryCard dealer={DEALER} />);

    expect(screen.getByText(/Sri Lakshmi Motors — yard photo/i)).toBeInTheDocument();
  });

  /**
   * The other branch, and the one that was unreachable until the API started
   * filling `coverUrl` in.
   *
   * `alt=""` is asserted rather than assumed: the heading beside the image
   * already names the dealership, so a described cover would have a screen
   * reader announce the name twice in a row. That makes the image decorative,
   * and a decorative image with a description is the usual way a card becomes
   * tiring to listen to.
   */
  it('shows the yard photograph when there is one, without describing it twice', () => {
    const { container } = render(
      <DirectoryCard
        dealer={{ ...DEALER, coverUrl: 'https://media.test/by-media/media-1/640.webp' }}
      />,
    );

    const image = container.querySelector('img');
    expect(image?.getAttribute('src')).toBe('https://media.test/by-media/media-1/640.webp');
    expect(image?.getAttribute('alt')).toBe('');
    expect(screen.queryByText(/yard photo/i)).toBeNull();
  });

  it('marks a verified dealership, and does not mark one that is not', () => {
    const { unmount } = render(<DirectoryCard dealer={DEALER} />);
    expect(screen.getByText('VERIFIED DEALER')).toBeInTheDocument();
    // The audit mark on the cover says the same thing in the place a buyer
    // looks first, and it carries no year — nothing records when a yard was
    // audited (R28).
    expect(screen.getByText('YARD VERIFIED')).toBeInTheDocument();
    unmount();

    render(<DirectoryCard dealer={{ ...DEALER, isVerified: false }} />);
    expect(screen.queryByText('VERIFIED DEALER')).toBeNull();
    expect(screen.queryByText('YARD VERIFIED')).toBeNull();
  });
});

const CITIES = [
  { slug: 'vellore', name: 'Vellore', count: 12 },
  { slug: 'katpadi', name: 'Katpadi', count: 7 },
];

const LOCATIONS: PublicLocations = {
  districts: [
    { slug: 'vellore', name: 'Vellore', count: 12, state: 'Tamil Nadu' },
    { slug: 'ranipet', name: 'Ranipet', count: 7, state: 'Tamil Nadu' },
  ],
  total: 19,
};

describe('DirectoryFilters', () => {
  it('pushes the chosen city onto the URL', async () => {
    const user = userEvent.setup();
    render(<DirectoryFilters locations={LOCATIONS} cities={CITIES} district="vellore" />);

    await user.click(screen.getByRole('button', { name: /^vellore/i }));

    expect(navigationState.pushed).toEqual(['/dealers?district=vellore&city=vellore']);
  });

  /**
   * The chips are toggles, not a radio group. A buyer working the Vellore belt
   * wants Katpadi *and* Vellore — twenty minutes apart — and single-select made
   * them run the same search twice and hold both results in their head.
   */
  it('adds a second city rather than replacing the first', async () => {
    const user = userEvent.setup();
    render(
      <DirectoryFilters
        locations={LOCATIONS}
        cities={CITIES}
        city={['vellore']}
        district="vellore"
      />,
    );

    await user.click(screen.getByRole('button', { name: /katpadi/i }));

    expect(navigationState.pushed).toEqual(['/dealers?district=vellore&city=katpadi%2Cvellore']);
  });

  /**
   * Sorted, so that choosing the same two towns in either order is the same
   * URL — one link to share and one cache entry rather than two of each.
   */
  it('writes the towns in a stable order however they were picked', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <DirectoryFilters
        locations={LOCATIONS}
        cities={CITIES}
        city={['katpadi']}
        district="vellore"
      />,
    );
    await user.click(screen.getByRole('button', { name: /^vellore/i }));
    unmount();

    render(
      <DirectoryFilters
        locations={LOCATIONS}
        cities={CITIES}
        city={['vellore']}
        district="vellore"
      />,
    );
    await user.click(screen.getByRole('button', { name: /katpadi/i }));

    expect(navigationState.pushed[0]).toBe(navigationState.pushed[1]);
  });

  it('takes a city back off when its chip is pressed again', async () => {
    const user = userEvent.setup();
    render(
      <DirectoryFilters
        locations={LOCATIONS}
        cities={CITIES}
        city={['vellore', 'katpadi']}
        district="vellore"
      />,
    );

    await user.click(screen.getByRole('button', { name: /^vellore/i }));

    expect(navigationState.pushed).toEqual(['/dealers?district=vellore&city=katpadi']);
  });

  it('says which chips are on', () => {
    render(
      <DirectoryFilters
        locations={LOCATIONS}
        cities={CITIES}
        city={['vellore']}
        district="vellore"
      />,
    );

    expect(screen.getByRole('button', { name: /^vellore/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /katpadi/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  /**
   * With one chip at a time, pressing the active one cleared the filter and
   * that was discoverable enough. With several on, un-pressing each in turn is
   * not — so there is a way out that scales.
   */
  it('offers one way out of a multi-selection, counted', async () => {
    const user = userEvent.setup();
    render(
      <DirectoryFilters
        locations={LOCATIONS}
        cities={CITIES}
        city={['vellore', 'katpadi']}
        district="vellore"
      />,
    );

    await user.click(screen.getByRole('button', { name: /clear 2 towns/i }));

    // The district survives: clearing the towns widens the search to the whole
    // district, not to the whole platform.
    expect(navigationState.pushed).toEqual(['/dealers?district=vellore']);
  });

  it('does not offer a way out when nothing is chosen', () => {
    render(<DirectoryFilters locations={LOCATIONS} cities={CITIES} district="vellore" />);

    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
  });

  /**
   * The district is the header's filter and this component only carries it —
   * but it must carry it through every navigation, or choosing a town would
   * silently widen the search back to the whole platform.
   */
  it('carries the district through a chip and a search', async () => {
    const user = userEvent.setup();
    render(<DirectoryFilters locations={LOCATIONS} cities={CITIES} district="vellore" />);

    await user.click(screen.getByRole('button', { name: /katpadi/i }));
    await user.type(screen.getByLabelText(/search dealership name/i), 'lakshmi{Enter}');

    expect(navigationState.pushed).toEqual([
      '/dealers?district=vellore&city=katpadi',
      '/dealers?district=vellore&q=lakshmi',
    ]);
  });

  it('carries the city through a name search', async () => {
    const user = userEvent.setup();
    render(<DirectoryFilters locations={LOCATIONS} cities={CITIES} city={['vellore']} />);

    await user.type(screen.getByLabelText(/search dealership name/i), 'lakshmi{Enter}');

    expect(navigationState.pushed).toEqual(['/dealers?city=vellore&q=lakshmi']);
  });

  it('carries the search through a chip', async () => {
    const user = userEvent.setup();
    render(
      <DirectoryFilters locations={LOCATIONS} cities={CITIES} q="lakshmi" district="vellore" />,
    );

    await user.click(screen.getByRole('button', { name: /katpadi/i }));

    expect(navigationState.pushed).toEqual(['/dealers?district=vellore&city=katpadi&q=lakshmi']);
  });

  it('ignores a search that is only whitespace', async () => {
    const user = userEvent.setup();
    render(<DirectoryFilters locations={LOCATIONS} cities={CITIES} />);

    await user.type(screen.getByLabelText(/search dealership name/i), '   {Enter}');

    expect(navigationState.pushed).toEqual(['/dealers']);
  });

  /**
   * R23 — the row's two shapes.
   *
   * With no district, `cities` is every town on the platform: forty-four of
   * them at 120 dealerships and worse with every signup. The button replaces
   * them, and the *results* are untouched — no district still means every
   * dealership, which is what keeps `/dealers` the page the SEO policy indexes.
   */
  describe('with no district chosen', () => {
    it('offers a district button instead of every town on the platform', () => {
      render(<DirectoryFilters locations={LOCATIONS} cities={CITIES} />);

      expect(screen.getByRole('button', { name: /select district/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^katpadi/i })).toBeNull();
      expect(screen.getByText(/showing every district/i)).toBeInTheDocument();
    });

    it('opens the picker and writes the district it chooses', async () => {
      const user = userEvent.setup();
      render(<DirectoryFilters locations={LOCATIONS} cities={CITIES} />);

      await user.click(screen.getByRole('button', { name: /select district/i }));
      await user.click(screen.getByRole('button', { name: /^ranipet/i }));

      expect(navigationState.pushed).toEqual(['/dealers?district=ranipet']);
    });

    /**
     * `indexPolicy` names `/dealers?city=vellore` an indexable canonical, so it
     * is a URL Google is invited to send people to. Hiding the row there would
     * apply a filter the buyer can neither see nor clear — worse than the wall
     * this revision removed, because the wall at least said what it was doing.
     */
    it('still shows a town that is already applied, and the way out of it', () => {
      render(<DirectoryFilters locations={LOCATIONS} cities={CITIES} city={['vellore']} />);

      expect(screen.getByRole('button', { name: /^vellore/i })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: /clear town/i })).toBeInTheDocument();
      // Still not the unapplied ones: an applied filter is not a reason to
      // render the row this revision removed.
      expect(screen.queryByRole('button', { name: /^katpadi/i })).toBeNull();
    });
  });

  /** Inside a district the towns are a readable set, so the button steps aside. */
  it('shows the towns and not the district button once a district is chosen', () => {
    render(<DirectoryFilters locations={LOCATIONS} cities={CITIES} district="vellore" />);

    expect(screen.getByRole('button', { name: /^katpadi/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /select district/i })).toBeNull();
    expect(screen.queryByText(/showing every district/i)).toBeNull();
  });

  it('restores the box from the URL when a navigation changes it', () => {
    const { rerender } = render(
      <DirectoryFilters locations={LOCATIONS} cities={CITIES} q="lakshmi" />,
    );
    expect(screen.getByLabelText(/search dealership name/i)).toHaveValue('lakshmi');

    // The back button, or a chip: the URL wins over what was typed.
    rerender(<DirectoryFilters locations={LOCATIONS} cities={CITIES} />);
    expect(screen.getByLabelText(/search dealership name/i)).toHaveValue('');
  });
});

/**
 * ARCHITECTURE §17.2. The directory is a page worth indexing; a name search is
 * an unbounded surface — one URL per string anybody has ever typed, each a
 * near-duplicate of the page above it.
 */
describe('the indexing policy', () => {
  it('indexes the directory and each city page, at their own URL', () => {
    expect(indexPolicy({ kind: 'dealers', hasQuery: false })).toEqual({
      robots: { index: true, follow: true },
      canonical: '/dealers',
    });
    expect(indexPolicy({ kind: 'dealers', city: 'vellore', hasQuery: false })).toEqual({
      robots: { index: true, follow: true },
      canonical: '/dealers?city=vellore',
    });
  });

  /** Still `follow`: the links out of a searched page are how deep pages get crawled. */
  it('keeps a name search out of the index but follows it', () => {
    expect(indexPolicy({ kind: 'dealers', city: 'vellore', hasQuery: true })).toEqual({
      robots: { index: false, follow: true },
      canonical: '/dealers?city=vellore',
    });
  });

  /** A9 answers this: it knows the live-listing count, and this layer does not. */
  it('defers to the API on a dealership page', () => {
    const canonical = 'https://dealers-drive.example/dealers/sri-lakshmi-motors';

    expect(indexPolicy({ kind: 'resolved', canonical, isIndexable: true }).robots).toEqual({
      index: true,
      follow: true,
    });
    expect(indexPolicy({ kind: 'resolved', canonical, isIndexable: false }).robots).toEqual({
      index: false,
      follow: true,
    });
  });
});
