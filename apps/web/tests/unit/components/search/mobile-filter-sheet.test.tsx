import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { navigationState } from '../../../setup';
import { FACETS } from './fixtures';

import { PORTFOLIO_FILTER_GROUPS } from '@/components/search/filter-panel';
import { MobileFilterSheet } from '@/components/search/mobile-filter-sheet';

/**
 * The mobile filter sheet (**F079**, DESIGN-SPEC §3.3). It is the same
 * `FilterPanel` on the `Dialog` primitive's `sheet` variant, so the focus trap,
 * Escape and the scroll lock are Radix's (covered by `dialog.test.tsx`); what
 * is asserted here is what this component adds.
 */
function sheet(props: Partial<Parameters<typeof MobileFilterSheet>[0]> = {}) {
  return render(
    <MobileFilterSheet
      facets={FACETS}
      params={{ district: 'ranipet', fuel: 'petrol', brand: 'hyundai' }}
      basePath="/cars"
      total={18}
      {...props}
    />,
  );
}

describe('the Filters button', () => {
  it('says how many filters are applied, to the eye and to a screen reader', () => {
    sheet();
    const button = screen.getByRole('button', { name: 'Filters, 2 filters applied' });
    expect(within(button).getByText('2')).toBeInTheDocument();
  });

  it('is plain when nothing is applied — the district is scope, not a filter', () => {
    sheet({ params: { district: 'ranipet' } });
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
  });

  it('opens a labelled modal sheet', async () => {
    const user = userEvent.setup();
    sheet();
    await user.click(screen.getByRole('button', { name: /^filters/i }));
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('group', { name: 'Brand' })).toBeInTheDocument();
  });
});

describe('inside the sheet', () => {
  it('applies a filter at once, and stays open so another can be added', async () => {
    const user = userEvent.setup();
    sheet();
    await user.click(screen.getByRole('button', { name: /^filters/i }));
    await user.click(screen.getByRole('checkbox', { name: 'Arcot (11 cars)' }));
    expect(navigationState.pushed).toEqual([
      '/cars?district=ranipet&city=arcot&brand=hyundai&fuel=petrol',
    ]);
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument();
  });

  it('shows the live total on its action, and closes on it', async () => {
    const user = userEvent.setup();
    const view = sheet();
    await user.click(screen.getByRole('button', { name: /^filters/i }));
    expect(screen.getByRole('button', { name: 'Show 18 cars' })).toBeInTheDocument();

    view.rerender(
      <MobileFilterSheet facets={FACETS} params={{ fuel: 'cng' }} basePath="/cars" total={1} />,
    );
    await user.click(screen.getByRole('button', { name: 'Show 1 car' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clears every filter but keeps the district', async () => {
    const user = userEvent.setup();
    sheet();
    await user.click(screen.getByRole('button', { name: /^filters/i }));
    await user.click(screen.getByRole('button', { name: 'Clear every filter' }));
    expect(navigationState.pushed).toEqual(['/cars?district=ranipet']);
  });

  it('cannot clear what is not there', async () => {
    const user = userEvent.setup();
    sheet({ params: {} });
    await user.click(screen.getByRole('button', { name: /^filters/i }));
    expect(screen.getByRole('button', { name: 'Clear every filter' })).toBeDisabled();
  });

  it('closes on Escape and hands focus back to the button', async () => {
    const user = userEvent.setup();
    sheet();
    const button = screen.getByRole('button', { name: /^filters/i });
    await user.click(button);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button).toHaveFocus();
  });

  it('offers only the groups it is given — no town or dealer on a portfolio', async () => {
    const user = userEvent.setup();
    sheet({ groups: PORTFOLIO_FILTER_GROUPS, params: {} });
    await user.click(screen.getByRole('button', { name: /^filters/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('group', { name: 'City / Town' })).toBeNull();
    expect(within(dialog).queryByRole('group', { name: 'Dealer' })).toBeNull();
  });
});
