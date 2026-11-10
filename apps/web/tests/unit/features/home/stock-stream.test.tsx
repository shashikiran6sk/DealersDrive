import type { VehicleCardDto } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('offers each car once to the keyboard and to assistive technology', () => {
    render(<StockStream cars={cars} />);
    const stream = within(screen.getByRole('region', { name: STOCK_STREAM_TEXT.label }));
    expect(stream.getAllByRole('link')).toHaveLength(4);
    expect(stream.getByRole('link', { name: /i10 c/ })).toHaveAttribute('href', '/car/c');
  });

  it('draws a hidden, inert second copy so the columns loop without a seam', () => {
    const { container } = render(<StockStream cars={cars} />);
    const copies = container.querySelectorAll('[inert]');
    expect(copies).toHaveLength(2);
    for (const copy of copies) expect(copy).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('a')).toHaveLength(8);
  });

  it('can be paused, and says so', async () => {
    const user = userEvent.setup();
    render(<StockStream cars={cars} />);
    const region = screen.getByRole('region', { name: STOCK_STREAM_TEXT.label });
    const pause = screen.getByRole('button', { name: STOCK_STREAM_TEXT.pause });

    expect(pause).toHaveAttribute('aria-pressed', 'false');
    expect(region).not.toHaveAttribute('data-paused');
    await user.click(pause);
    expect(pause).toHaveAttribute('aria-pressed', 'true');
    expect(region).toHaveAttribute('data-paused');
    await user.click(pause);
    expect(region).not.toHaveAttribute('data-paused');
  });
});

describe('MakesStrip', () => {
  const makes = ['Hyundai', 'Tata', 'Honda'].map((label) => ({
    label,
    href: `/cars?brand=${label.toLowerCase()}`,
  }));

  it('links every make to its search', () => {
    render(<MakesStrip makes={makes} />);
    const strip = within(screen.getByRole('navigation', { name: MAKES_STRIP_TEXT.label }));
    expect(strip.getByRole('link', { name: 'Honda' })).toHaveAttribute('href', '/cars?brand=honda');
  });

  it('draws a hidden, inert second copy so the strip loops without a seam', () => {
    const { container } = render(<MakesStrip makes={makes} />);
    const copy = container.querySelector('[data-loop-copy]');
    expect(copy).toHaveAttribute('aria-hidden', 'true');
    expect(copy).toHaveAttribute('inert');
    expect(container.querySelectorAll('a')).toHaveLength(6);
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('can be paused, which is what makes it a row to scroll by hand', async () => {
    const user = userEvent.setup();
    render(<MakesStrip makes={makes} />);
    const strip = screen.getByRole('navigation', { name: MAKES_STRIP_TEXT.label });
    const pause = screen.getByRole('button', { name: MAKES_STRIP_TEXT.pause });

    expect(strip).not.toHaveAttribute('data-paused');
    await user.click(pause);
    expect(pause).toHaveAttribute('aria-pressed', 'true');
    expect(strip).toHaveAttribute('data-paused');
  });

  it('renders nothing for fewer than three makes', () => {
    const { container } = render(<MakesStrip makes={makes.slice(0, 2)} />);
    expect(container).toBeEmptyDOMElement();
  });
});
