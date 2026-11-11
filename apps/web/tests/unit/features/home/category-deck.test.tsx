import type { VehicleCardDto } from '@dealers-drive/contracts';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CategoryCard,
  CategoryIcon,
  coverProgress,
  DECK_TEXT,
  DeckProgress,
  DeckStack,
  type HomeCategoryView,
  isBeside,
  nearestToStart,
} from '@/features/home/category-deck';
import { HOME_CATEGORIES, type HomeCategoryIcon } from '@/features/home/home.constants';

function car(slug: string): VehicleCardDto {
  return {
    slug,
    availability: 'AVAILABLE',
    title: `2016 Hyundai Creta ${slug}`,
    year: 2016,
    priceLabel: '₹7,25,000',
    negotiability: null,
    metaLabel: '1,05,384 km · Diesel · Manual · Vellore',
    image: { url: `https://media.example.org/${slug}.webp`, alt: `Photo of ${slug}` },
    imageCount: 1,
    dealer: { name: 'Thirumurugan Cars', slug: 'tc', initials: 'TC', isVerified: true },
  };
}

function view(index: number, cars: VehicleCardDto[]): HomeCategoryView {
  const base = HOME_CATEGORIES[index];
  if (!base) throw new Error('no category');
  return { ...base, href: '/cars?x=1', cars };
}

describe('coverProgress — how far the next card has slid over this one', () => {
  it('is 0 while the next card is a full card-height below', () => {
    expect(coverProgress({ top: 100, height: 500 }, { top: 600 })).toBe(0);
    expect(coverProgress({ top: 100, height: 500 }, { top: 900 })).toBe(0);
  });

  it('grows as the next card arrives, and stops at 1', () => {
    expect(coverProgress({ top: 100, height: 500 }, { top: 350 })).toBeCloseTo(0.5);
    expect(coverProgress({ top: 100, height: 500 }, { top: 100 })).toBe(1);
    expect(coverProgress({ top: 100, height: 500 }, { top: 40 })).toBe(1);
  });

  it('never divides by a zero height', () => {
    expect(coverProgress({ top: 0, height: 0 }, { top: 0 })).toBe(1);
  });
});

describe('isBeside — whether the deck is laid out as a swipe row', () => {
  it('is true only when the next card starts to the right of this one', () => {
    expect(isBeside({ left: 35 }, { left: 369 })).toBe(true);
    expect(isBeside({ left: 40 }, { left: 40 })).toBe(false);
    expect(isBeside({ left: 40 }, { left: 40.5 })).toBe(false);
  });
});

describe('nearestToStart — which card the swipe row is showing', () => {
  const row = { left: 0 };

  it('picks the card whose left edge is closest to the start of the row', () => {
    const cards = [
      { left: -620, width: 304 },
      { left: -302, width: 304 },
      { left: 16, width: 304 },
      { left: 334, width: 304 },
    ];
    expect(nearestToStart(row, cards)).toBe(2);
  });

  it('picks the last card when the row is scrolled to its end', () => {
    const cards = [
      { left: -566, width: 304 },
      { left: -248, width: 304 },
      { left: 70, width: 304 },
    ];
    expect(nearestToStart(row, cards)).toBe(2);
  });

  it('answers the first card when there is nothing to measure', () => {
    expect(nearestToStart(row, [])).toBe(0);
  });
});

describe('DeckProgress', () => {
  it('shows the position and fills the bar by the same share, as decoration', () => {
    const { container } = render(<DeckProgress current={2} total={5} />);
    const progress = container.querySelector('[data-deck-progress]');
    expect(progress).toHaveTextContent('03 / 05');
    expect(progress?.querySelector('[style]')).toHaveStyle({ transform: 'scaleX(0.6)' });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says which way to go and steps a card at a time', async () => {
    const user = userEvent.setup();
    const onStep = vi.fn();
    render(<DeckProgress current={1} total={3} onStep={onStep} />);
    expect(screen.getByText(DECK_TEXT.swipe)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: DECK_TEXT.next }));
    await user.click(screen.getByRole('button', { name: DECK_TEXT.previous }));
    expect(onStep.mock.calls).toEqual([[1], [-1]]);
  });

  it('stops at both ends', () => {
    const { rerender } = render(<DeckProgress current={0} total={3} onStep={vi.fn()} />);
    expect(screen.getByRole('button', { name: DECK_TEXT.previous })).toBeDisabled();
    expect(screen.getByRole('button', { name: DECK_TEXT.next })).toBeEnabled();
    rerender(<DeckProgress current={2} total={3} onStep={vi.fn()} />);
    expect(screen.getByRole('button', { name: DECK_TEXT.next })).toBeDisabled();
  });
});

describe('CategoryCard', () => {
  it('names itself by its heading and says where it sits in the deck', () => {
    render(<CategoryCard category={view(0, [car('a')])} position={1} total={5} />);
    const card = screen.getByRole('article', { name: 'SUVs' });
    expect(within(card).getByText('02 / 05')).toBeInTheDocument();
    expect(card).toHaveAttribute('id', 'home-category-suv');
  });

  it('leads with the first car large and the next two beside it, each linked', () => {
    render(
      <CategoryCard category={view(0, [car('a'), car('b'), car('c')])} position={0} total={5} />,
    );
    expect(screen.getByRole('img', { name: 'Photo of a' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Creta b/ })).toHaveAttribute('href', '/car/b');
    expect(screen.getByRole('link', { name: /Creta c/ })).toHaveAttribute('href', '/car/c');
    expect(screen.getByRole('link', { name: 'Browse SUVs' })).toHaveAttribute('href', '/cars?x=1');
  });

  it('describes the category in its own facts', () => {
    render(<CategoryCard category={view(4, [car('a')])} position={4} total={5} />);
    expect(screen.getByText('Distance')).toBeInTheDocument();
    expect(screen.getByText('Under 1,00,000 km')).toBeInTheDocument();
    expect(screen.getByText(DECK_TEXT.featured)).toBeInTheDocument();
  });
});

describe('CategoryIcon', () => {
  it.each<HomeCategoryIcon>(['suv', 'automatic', 'price', 'family', 'odometer'])(
    'draws %s as decoration only',
    (icon) => {
      const { container } = render(<CategoryIcon icon={icon} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg?.childElementCount).toBeGreaterThan(0);
    },
  );
});

describe('DeckStack', () => {
  const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  let frames: FrameRequestCallback[] = [];

  function flushFrames() {
    const due = frames;
    frames = [];
    for (const run of due) run(0);
  }

  beforeEach(() => {
    media.matches = false;
    frames = [];
    vi.stubGlobal('matchMedia', () => media);
    vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => frames.push(run));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function deck() {
    render(
      <DeckStack>
        <article data-deck-card>first</article>
        <article data-deck-card>second</article>
      </DeckStack>,
    );
    const [first, second] = screen.getAllByRole('article');
    if (!first || !second) throw new Error('missing card');
    vi.spyOn(first, 'getBoundingClientRect').mockReturnValue({ top: 100, height: 400 } as DOMRect);
    vi.spyOn(second, 'getBoundingClientRect').mockReturnValue({ top: 300, height: 400 } as DOMRect);
    act(() => {
      flushFrames();
      window.dispatchEvent(new Event('scroll'));
      flushFrames();
    });
    return { first, second };
  }

  it('dims the card underneath as the next one slides over it', () => {
    const { first, second } = deck();
    expect(first.style.getPropertyValue('--deck-cover')).toBe('0.500');
    expect(second.style.getPropertyValue('--deck-cover')).toBe('0.000');
  });

  it('shows no progress bar unless it is told how many cards there are', () => {
    const { container } = render(
      <DeckStack>
        <article data-deck-card>only</article>
      </DeckStack>,
    );
    expect(container.querySelector('[data-deck-progress]')).toBeNull();
  });

  it('as a swipe row, follows the card at the start, never dims a card, and steps on request', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DeckStack total={3}>
        <article data-deck-card>first</article>
        <article data-deck-card>second</article>
        <article data-deck-card>third</article>
      </DeckStack>,
    );
    const row = container.querySelector('[data-deck-card]')?.parentElement;
    const cards = screen.getAllByRole('article');
    if (!row) throw new Error('missing row');
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 390 } as DOMRect);
    const reveal = vi.fn();
    [-302, 16, 334].forEach((left, index) => {
      const card = cards[index];
      if (!card) throw new Error('missing card');
      card.scrollIntoView = reveal;
      vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        height: 500,
        left,
        width: 304,
      } as DOMRect);
    });
    expect(container.querySelector('[data-deck-progress]')).toHaveTextContent('01 / 03');
    act(() => {
      flushFrames();
      row.dispatchEvent(new Event('scroll'));
      flushFrames();
    });
    expect(container.querySelector('[data-deck-progress]')).toHaveTextContent('02 / 03');
    for (const card of cards) expect(card.style.getPropertyValue('--deck-cover')).toBe('0.000');

    await user.click(screen.getByRole('button', { name: DECK_TEXT.next }));
    expect(reveal.mock.contexts).toEqual([cards[2]]);
    expect(reveal).toHaveBeenCalledWith({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  });

  it('leaves every card flat for a visitor who asked for less motion', () => {
    media.matches = true;
    const { first } = deck();
    expect(first.style.getPropertyValue('--deck-cover')).toBe('0.000');
  });
});
