import type { VehicleCardDto } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MakesStrip, MAKES_STRIP_TEXT } from '@/features/home/makes-strip';
import { splitColumns, StockStream, STOCK_STREAM_TEXT } from '@/features/home/stock-stream';

function car(slug: string): VehicleCardDto {
  return {
    slug,
    availability: 'AVAILABLE',
    title: `2013 Hyundai i10 ${slug}`,
    year: 2013,
    priceLabel: '₹2,35,000',
    negotiability: 'SLIGHTLY',
    metaLabel: '1,02,935 km · Petrol · Automatic · Vellore',
    image: null,
    imageCount: 0,
    dealer: { name: 'Suyambu Cars Vellore', slug: 'sc', initials: 'SC', isVerified: true },
  };
}

describe('splitColumns', () => {
  it('deals the cars into two columns, alternately', () => {
    expect(splitColumns([1, 2, 3, 4, 5])).toEqual([
      [1, 3, 5],
      [2, 4],
    ]);
    expect(splitColumns([])).toEqual([[], []]);
  });
});

describe('StockStream', () => {
  const cars = ['a', 'b', 'c', 'd'].map(car);

  it('shows cars as non-interactive content with no pause control', () => {
    render(<StockStream cars={cars} />);
    const stream = within(screen.getByRole('region', { name: STOCK_STREAM_TEXT.label }));
    expect(stream.getAllByRole('article')).toHaveLength(4);
    expect(stream.getAllByText(/2013 Hyundai i10/)).toHaveLength(8);
    expect(stream.queryByRole('link')).not.toBeInTheDocument();
    expect(stream.queryByRole('button')).not.toBeInTheDocument();
  });

  /**
   * The columns move by CSS animation, which the browser's lazy-load check
   * notices late: a lazy photo started downloading only once its card was
   * already on screen, so cars drifted into view blank. Every photo in the
   * stream is fetched up front instead; the loop copy reuses the same URLs.
   */
  it('loads every photo straight away rather than lazily', () => {
    const withPhotos = cars.map((entry) => ({
      ...entry,
      image: { url: `https://media.example.org/${entry.slug}/640.webp`, alt: entry.title },
    }));
    const { container } = render(<StockStream cars={withPhotos} />);
    const photos = container.querySelectorAll('img');
    expect(photos).toHaveLength(8);
    for (const photo of photos) expect(photo).toHaveAttribute('loading', 'eager');
  });

  it('hides only the duplicate loop content from assistive technology', () => {
    const { container } = render(<StockStream cars={cars} />);
    const copies = container.querySelectorAll('[data-loop-copy]');
    expect(copies).toHaveLength(2);
    for (const copy of copies) expect(copy).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('article')).toHaveLength(8);
    expect(container.querySelectorAll('a, button, [tabindex]')).toHaveLength(0);
  });
});

describe('MakesStrip', () => {
  const makes = ['Hyundai', 'Tata', 'Honda'].map((label) => ({
    label,
    href: `/cars?brand=${label.toLowerCase()}`,
  }));

  it('displays the makes without links or a pause control', () => {
    render(<MakesStrip makes={makes} />);
    const strip = within(screen.getByRole('region', { name: MAKES_STRIP_TEXT.label }));
    expect(strip.getAllByRole('listitem')).toHaveLength(3);
    expect(strip.getAllByText('Honda')).toHaveLength(2);
    expect(strip.queryByRole('link')).not.toBeInTheDocument();
    expect(strip.queryByRole('button')).not.toBeInTheDocument();
  });

  it('hides the duplicate list from assistive technology', () => {
    const { container } = render(<MakesStrip makes={makes} />);
    expect(container.querySelector('[data-loop-copy]')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('a, button, [tabindex]')).toHaveLength(0);
  });

  it('renders nothing for fewer than three makes', () => {
    const { container } = render(<MakesStrip makes={makes.slice(0, 2)} />);
    expect(container).toBeEmptyDOMElement();
  });
});
