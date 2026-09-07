import type { DealerCard } from '@dealers-drive/contracts';
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
 * crawler is invited to index. Nothing here pins the 104px cover or the 34px
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
    expect(screen.getByText('VERIFIED')).toBeInTheDocument();
    unmount();

    render(<DirectoryCard dealer={{ ...DEALER, isVerified: false }} />);
    expect(screen.queryByText('VERIFIED')).toBeNull();
  });
});

const CITIES = [
  { slug: 'vellore', name: 'Vellore', count: 12 },
  { slug: 'katpadi', name: 'Katpadi', count: 7 },
];

describe('DirectoryFilters', () => {
  it('pushes the chosen city onto the URL', async () => {
    const user = userEvent.setup();
    render(<DirectoryFilters cities={CITIES} />);

    await user.click(screen.getByRole('button', { name: /vellore/i }));

    expect(navigationState.pushed).toEqual(['/dealers?city=vellore']);
  });

  /** Pressing the chip that is on is the only way back to every city. */
  it('clears the filter when the chosen chip is pressed again', async () => {
    const user = userEvent.setup();
    render(<DirectoryFilters cities={CITIES} city="vellore" />);

    await user.click(screen.getByRole('button', { name: /vellore/i }));

    expect(navigationState.pushed).toEqual(['/dealers']);
  });

  it('says which chip is on', () => {
    render(<DirectoryFilters cities={CITIES} city="vellore" />);

    expect(screen.getByRole('button', { name: /vellore/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /katpadi/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('carries the city through a name search', async () => {
    const user = userEvent.setup();
    render(<DirectoryFilters cities={CITIES} city="vellore" />);

    await user.type(screen.getByLabelText(/search dealership name/i), 'lakshmi{Enter}');

    expect(navigationState.pushed).toEqual(['/dealers?city=vellore&q=lakshmi']);
  });

  it('carries the search through a chip', async () => {
    const user = userEvent.setup();
    render(<DirectoryFilters cities={CITIES} q="lakshmi" />);

    await user.click(screen.getByRole('button', { name: /katpadi/i }));

    expect(navigationState.pushed).toEqual(['/dealers?city=katpadi&q=lakshmi']);
  });

  it('ignores a search that is only whitespace', async () => {
    const user = userEvent.setup();
    render(<DirectoryFilters cities={CITIES} />);

    await user.type(screen.getByLabelText(/search dealership name/i), '   {Enter}');

    expect(navigationState.pushed).toEqual(['/dealers']);
  });

  it('restores the box from the URL when a navigation changes it', () => {
    const { rerender } = render(<DirectoryFilters cities={CITIES} q="lakshmi" />);
    expect(screen.getByLabelText(/search dealership name/i)).toHaveValue('lakshmi');

    // The back button, or a chip: the URL wins over what was typed.
    rerender(<DirectoryFilters cities={CITIES} />);
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
