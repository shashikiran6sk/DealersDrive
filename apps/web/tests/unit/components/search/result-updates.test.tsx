import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { FACETS } from './fixtures';

import { CarSearchBox } from '@/components/search/car-search-box';
import { FilterPanel } from '@/components/search/filter-panel';
import { MobileFilterSheet } from '@/components/search/mobile-filter-sheet';
import { resultsRegionClass } from '@/components/search/search-navigation';

/**
 * A filter change updates the page in place (**R57**). The server sends new
 * props — facets, params, total — to the same client components, and what a
 * buyer set up in them must survive: the rows a list was opened to, the sheet
 * they are working in, the box they are typing in. Each test re-renders a
 * control with the next page's props, which is exactly what a navigation does
 * to it, and asserts the state is still there and the element is the same one.
 */
const NEXT_FACETS = {
  ...FACETS,
  brands: FACETS.brands.map((option) => ({ ...option, count: Math.max(0, option.count - 1) })),
};

describe('the filter panel across an update', () => {
  it('keeps a list it was opened to, and is the same element', async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(
      <FilterPanel facets={FACETS} params={{}} basePath="/cars" />,
    );
    const panel = container.firstElementChild;
    const brand = screen.getByRole('group', { name: 'Brand' });
    await user.click(within(brand).getByRole('button', { name: 'Show all 8' }));

    rerender(<FilterPanel facets={NEXT_FACETS} params={{ fuel: 'petrol' }} basePath="/cars" />);

    expect(container.firstElementChild).toBe(panel);
    const after = screen.getByRole('group', { name: 'Brand' });
    expect(within(after).getAllByRole('checkbox')).toHaveLength(8);
    expect(within(after).getByRole('button', { name: 'Show fewer' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});

describe('the mobile sheet across an update', () => {
  it('stays open on the next page, with the new total on its button', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MobileFilterSheet
        facets={FACETS}
        params={{ district: 'ranipet' }}
        basePath="/cars"
        total={24}
      />,
    );
    await user.click(screen.getByRole('button', { name: /^filters/i }));
    const dialog = screen.getByRole('dialog', { name: 'Filters' });

    rerender(
      <MobileFilterSheet
        facets={NEXT_FACETS}
        params={{ district: 'ranipet', fuel: 'petrol' }}
        basePath="/cars"
        total={18}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Filters' })).toBe(dialog);
    expect(within(dialog).getByRole('button', { name: /18 cars/ })).toBeInTheDocument();
  });
});

describe('the search box across an update', () => {
  it('keeps the focus and what is typed when the other filters change', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CarSearchBox params={{ district: 'ranipet' }} basePath="/cars" />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.keyboard('swi');

    rerender(<CarSearchBox params={{ district: 'ranipet', fuel: 'cng' }} basePath="/cars" />);

    expect(screen.getByRole('combobox')).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue('swi');
  });
});

/**
 * The results dim while the next page renders — but only once it has taken
 * long enough to notice. A filter change typically answers in about 200 ms, and
 * a fade that starts and stops inside that is itself the flicker.
 */
describe('the results while the next page renders', () => {
  it('fades only after a delay, and lightly', () => {
    const pending = resultsRegionClass(true);
    expect(pending).toContain('delay-200');
    expect(pending).toContain('opacity-60');
    expect(pending).toContain('transition-opacity');
  });

  it('comes back at once, with no delay, when the page arrives', () => {
    const settled = resultsRegionClass(false);
    expect(settled).not.toMatch(/delay-|opacity-/);
    expect(settled).toContain('transition-opacity');
  });
});
