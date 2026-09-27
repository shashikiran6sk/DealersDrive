import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { navigationState } from '../../../setup';
import { FACETS } from './fixtures';

import { AppliedFilters } from '@/components/search/applied-filters';

/** DESIGN-SPEC §3.3's chip row: every applied filter, each one a way to remove it. */
describe('the applied filters', () => {
  it('renders nothing when nothing is applied', () => {
    const { container } = render(
      <AppliedFilters facets={FACETS} params={{ district: 'ranipet' }} basePath="/cars" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('names each filter the way the panel does', () => {
    render(
      <AppliedFilters
        facets={FACETS}
        params={{
          city: 'arcot',
          fuel: 'petrol',
          minPrice: '50000000',
          maxPrice: '100000000',
          minYear: '2019',
          minKm: '1000',
          maxKm: '9000',
          q: 'creta',
        }}
        basePath="/cars"
      />,
    );
    for (const name of [
      'Remove filter: “creta”',
      'Remove filter: Arcot',
      'Remove filter: Petrol',
      'Remove filter: Price: ₹5–10 lakh',
      'Remove filter: Year: 2019 – …',
      'Remove filter: Km: 1,000 km – 9,000 km',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('removes one filter and keeps the rest', async () => {
    const user = userEvent.setup();
    render(
      <AppliedFilters
        facets={FACETS}
        params={{ district: 'ranipet', fuel: 'petrol,cng', page: '2' }}
        basePath="/cars"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Remove filter: CNG' }));
    expect(navigationState.pushed).toEqual(['/cars?district=ranipet&fuel=petrol']);
  });

  it('clears every filter but not the district', async () => {
    const user = userEvent.setup();
    render(
      <AppliedFilters
        facets={FACETS}
        params={{ district: 'ranipet', fuel: 'petrol', brand: 'kia' }}
        basePath="/cars"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Clear every filter' }));
    expect(navigationState.pushed).toEqual(['/cars?district=ranipet']);
  });
});
