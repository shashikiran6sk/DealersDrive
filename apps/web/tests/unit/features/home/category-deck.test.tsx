import type { VehicleCardDto } from '@dealers-drive/contracts';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CategoryCard,
  CategoryIcon,
  coverProgress,
  DECK_TEXT,
  DeckStack,
  type HomeCategoryView,
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

  it('leaves every card flat for a visitor who asked for less motion', () => {
    media.matches = true;
    const { first } = deck();
    expect(first.style.getPropertyValue('--deck-cover')).toBe('0.000');
  });
});
