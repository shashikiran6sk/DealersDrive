import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { navigationState } from '../../../setup';
import { FACETS, HYUNDAI_MODELS } from './fixtures';

import { FilterPanel, PORTFOLIO_FILTER_GROUPS } from '@/components/search/filter-panel';

/**
 * The filter panel (**F078**, DESIGN-SPEC §3.3). It writes to the URL and
 * nothing else, so every assertion here is about the URL a control writes —
 * the one thing the page, the back button and a shared link all depend on.
 */
function groupNames(): string[] {
  return screen
    .getAllByRole('group')
    .map(
      (group) =>
        group.getAttribute('aria-label') ?? group.querySelector('legend')?.textContent ?? '',
    );
}

describe('what it offers', () => {
  it('lists every group in the order the brief sets, with no generic location', () => {
    render(<FilterPanel facets={FACETS} params={{ district: 'ranipet' }} basePath="/cars" />);
    expect(groupNames()).toEqual([
      'City / Town',
      'Brand',
      'Model',
      'Price',
      'Year',
      'Kilometers driven',
      'Fuel type',
      'Transmission',
      'Body type',
      'Color',
      'Owners',
      'Dealer',
    ]);
    expect(screen.queryByText(/^location$/i)).toBeNull();
  });

  it('leaves out a group with nothing in it', () => {
    render(
      <FilterPanel
        facets={{ ...FACETS, colors: [], ownerCounts: [] }}
        params={{ district: 'ranipet' }}
        basePath="/cars"
      />,
    );
    expect(groupNames()).not.toContain('Color');
    expect(groupNames()).not.toContain('Owners');
  });

  it('labels each value with its count, readable as one name', () => {
    render(<FilterPanel facets={FACETS} params={{}} basePath="/cars" />);
    expect(screen.getByRole('checkbox', { name: 'Petrol (18 cars)' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Mahindra (3 cars)' })).toBeDefined();
  });

  it('asks for a brand before it offers models', () => {
    render(<FilterPanel facets={FACETS} params={{}} basePath="/cars" />);
    expect(screen.getByText('Choose a brand to see its models.')).toBeInTheDocument();
  });

  it('shows the first six of a long list, and the rest on request', async () => {
    const user = userEvent.setup();
    render(<FilterPanel facets={FACETS} params={{}} basePath="/cars" />);
    const brand = screen.getByRole('group', { name: 'Brand' });
    expect(within(brand).getAllByRole('checkbox')).toHaveLength(6);

    await user.click(within(brand).getByRole('button', { name: 'Show all 8' }));
    expect(within(brand).getAllByRole('checkbox')).toHaveLength(8);
    expect(within(brand).getByRole('button', { name: 'Show fewer' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('keeps a ticked value visible even past the fold', () => {
    render(<FilterPanel facets={FACETS} params={{ brand: 'skoda' }} basePath="/cars" />);
    expect(screen.getByRole('checkbox', { name: 'Skoda (1 car)' })).toBeChecked();
  });

  it('offers no town, district or dealer on a dealership page', () => {
    render(
      <FilterPanel
        facets={FACETS}
        params={{}}
        basePath="/dealers/arcot-city-cars"
        groups={PORTFOLIO_FILTER_GROUPS}
      />,
    );
    const names = groupNames();
    expect(names).not.toContain('City / Town');
    expect(names).not.toContain('Dealer');
    expect(names).toContain('Brand');
  });
});

describe('what it writes', () => {
  it('ticks a value into the URL, keeping the district and dropping the page', async () => {
    const user = userEvent.setup();
    render(
      <FilterPanel facets={FACETS} params={{ district: 'ranipet', page: '3' }} basePath="/cars" />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Arcot (11 cars)' }));
    expect(navigationState.pushed).toEqual(['/cars?district=ranipet&city=arcot']);
  });

  it('adds a second value to the same group, as a list', async () => {
    const user = userEvent.setup();
    render(<FilterPanel facets={FACETS} params={{ fuel: 'petrol' }} basePath="/cars" />);
    await user.click(screen.getByRole('checkbox', { name: 'Diesel (8 cars)' }));
    expect(navigationState.pushed).toEqual(['/cars?fuel=diesel%2Cpetrol']);
  });

  it("unticks a brand and drops that brand's models with it", async () => {
    const user = userEvent.setup();
    render(
      <FilterPanel
        facets={{ ...FACETS, models: HYUNDAI_MODELS }}
        params={{ brand: 'hyundai,tata', model: 'creta,nexon' }}
        basePath="/cars"
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Creta (3 cars)' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Hyundai (6 cars)' }));
    expect(navigationState.pushed).toEqual(['/cars?brand=tata&model=nexon']);
  });

  it('writes a price preset as its two bounds, and Any price as neither', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<FilterPanel facets={FACETS} params={{}} basePath="/cars" />);
    await user.click(screen.getByRole('radio', { name: '₹5–10 lakh (18 cars)' }));
    expect(navigationState.pushed).toEqual(['/cars?minPrice=50000000&maxPrice=100000000']);
    unmount();

    navigationState.pushed.length = 0;
    render(
      <FilterPanel
        facets={FACETS}
        params={{ minPrice: '50000000', maxPrice: '100000000' }}
        basePath="/cars"
      />,
    );
    expect(screen.getByRole('radio', { name: '₹5–10 lakh (18 cars)' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Any price' }));
    expect(navigationState.pushed).toEqual(['/cars']);
  });

  it('shows a range that is no preset as a custom one', () => {
    render(
      <FilterPanel facets={FACETS} params={{ minKm: '5000', maxKm: '25000' }} basePath="/cars" />,
    );
    expect(
      screen.getByRole('radio', { name: /custom range: 5,000 km – 25,000 km/i }),
    ).toBeChecked();
  });

  it('writes a year range from the two selects, never an inverted one', async () => {
    const user = userEvent.setup();
    render(<FilterPanel facets={FACETS} params={{ maxYear: '2019' }} basePath="/cars" />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Earliest year' }), '2021');
    expect(navigationState.pushed).toEqual(['/cars?minYear=2021']);
  });

  it('clears one group, and a brand with its models', async () => {
    const user = userEvent.setup();
    render(
      <FilterPanel
        facets={{ ...FACETS, models: HYUNDAI_MODELS }}
        params={{ brand: 'hyundai', model: 'creta', fuel: 'cng' }}
        basePath="/cars"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Clear brand' }));
    expect(navigationState.pushed).toEqual(['/cars?fuel=cng']);
  });

  it('clears every filter but keeps the district, search and sort', async () => {
    const user = userEvent.setup();
    render(
      <FilterPanel
        facets={FACETS}
        params={{ district: 'ranipet', city: 'arcot', q: 'creta', fuel: 'cng', sort: 'km_asc' }}
        basePath="/cars"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Clear every filter' }));
    expect(navigationState.pushed).toEqual(['/cars?district=ranipet&q=creta&sort=km_asc']);
  });

  it('offers no Clear all when nothing is filtered', () => {
    render(<FilterPanel facets={FACETS} params={{ district: 'ranipet' }} basePath="/cars" />);
    expect(screen.queryByRole('button', { name: 'Clear every filter' })).toBeNull();
  });

  it('says so when there is nothing to filter', () => {
    render(
      <FilterPanel
        facets={{ ...FACETS, price: FACETS.price.map((band) => ({ ...band, count: 0 })) }}
        params={{}}
        basePath="/cars"
      />,
    );
    expect(screen.getByText('Nothing to filter by here yet.')).toBeInTheDocument();
  });
});

/**
 * Which groups a buyer is offered depends on the district (**R53**): a town and
 * a dealership are both inside one, so with every district in scope neither
 * list would be readable, and both lead out of a scope the buyer never chose.
 */
describe('the district decides the place filters', () => {
  it('offers no City / Town and no Dealer with every district in scope', () => {
    render(<FilterPanel facets={FACETS} params={{}} basePath="/cars" />);
    expect(groupNames()).not.toContain('City / Town');
    expect(groupNames()).not.toContain('Dealer');
    expect(groupNames()).toContain('Brand');
    expect(groupNames()).toContain('Color');
  });

  it('offers both once a district is chosen', () => {
    render(<FilterPanel facets={FACETS} params={{ district: 'ranipet' }} basePath="/cars" />);
    expect(groupNames()).toContain('City / Town');
    expect(groupNames()).toContain('Dealer');
  });
});

/**
 * An option with nothing behind it is shown, so the list does not jump around
 * as filters change, but it is **disabled** — not merely grey (**R53**). It
 * cannot be ticked by mouse, by its label or by the keyboard, so it can never
 * write a filter that empties the page.
 */
describe('an option with nothing behind it', () => {
  const ZERO = {
    ...FACETS,
    fuelTypes: [...FACETS.fuelTypes, { value: 'electric', label: 'Electric', count: 0 }],
  };

  it('is a disabled control, still named with its count', () => {
    render(<FilterPanel facets={ZERO} params={{}} basePath="/cars" />);
    const electric = screen.getByRole('checkbox', { name: 'Electric (0 cars)' });
    expect(electric).toBeDisabled();
    expect(electric.closest('label')).toHaveClass('cursor-not-allowed');
    expect(screen.getByRole('radio', { name: '₹20 lakh+ (0 cars)' })).toBeDisabled();
  });

  it('cannot be ticked by a click on the box or its label', async () => {
    const user = userEvent.setup();
    render(<FilterPanel facets={ZERO} params={{}} basePath="/cars" />);
    const electric = screen.getByRole('checkbox', { name: 'Electric (0 cars)' });
    await user.click(electric);
    await user.click(screen.getByText('Electric'));
    await user.click(screen.getByRole('radio', { name: '₹20 lakh+ (0 cars)' }));
    expect(electric).not.toBeChecked();
    expect(navigationState.pushed).toEqual([]);
  });

  it('is skipped by the keyboard and cannot be ticked with Space', async () => {
    const user = userEvent.setup();
    render(<FilterPanel facets={ZERO} params={{}} basePath="/cars" />);
    const cng = screen.getByRole('checkbox', { name: 'CNG (12 cars)' });
    cng.focus();
    await user.tab();
    expect(screen.getByRole('checkbox', { name: 'Electric (0 cars)' })).not.toHaveFocus();
    await user.keyboard(' ');
    expect(navigationState.pushed.every((url) => !url.includes('electric'))).toBe(true);
  });

  it('stays enabled while it is ticked, so it can be unticked', async () => {
    const user = userEvent.setup();
    render(<FilterPanel facets={ZERO} params={{ fuel: 'electric' }} basePath="/cars" />);
    const electric = screen.getByRole('checkbox', { name: 'Electric (0 cars)' });
    expect(electric).toBeEnabled();
    expect(electric).toBeChecked();
    await user.click(electric);
    expect(navigationState.pushed).toEqual(['/cars']);
  });

  it('shows every generic colour, disabling the ones nothing is in', () => {
    render(<FilterPanel facets={FACETS} params={{ district: 'ranipet' }} basePath="/cars" />);
    const colour = within(screen.getByRole('group', { name: 'Color' }));
    expect(colour.getByRole('checkbox', { name: 'Green (0 cars)' })).toBeDisabled();
    expect(colour.getByRole('checkbox', { name: 'White (9 cars)' })).toBeEnabled();
  });
});
