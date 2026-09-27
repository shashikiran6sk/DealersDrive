import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { navigationState } from '../../../setup';

import { SEARCH_DEBOUNCE_MS, SearchToolbar } from '@/components/search/search-toolbar';

/**
 * The search box and the sort (**F080**). Both write to the URL; the box does
 * it after a pause in typing, and replaces the entry rather than adding one
 * per word, so Back leaves the search instead of un-typing it a word at a time.
 */
describe('the search box', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(params = {}) {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const view = render(<SearchToolbar params={params} basePath="/cars" />);
    return { user, view, box: screen.getByRole('searchbox', { name: /search cars/i }) };
  }

  it('asks once, after the typing stops — not per keystroke', async () => {
    const { user, box } = setup({ district: 'ranipet', page: '3' });
    await user.type(box, 'creta');
    expect(navigationState.replaced).toEqual([]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 10);
    });
    expect(navigationState.replaced).toEqual(['/cars?district=ranipet&q=creta']);
    expect(navigationState.pushed).toEqual([]);
  });

  it('collapses spacing, and treats a blank box as no search', async () => {
    const { user, box } = setup({ q: 'creta', fuel: 'cng' });
    await user.clear(box);
    await user.type(box, '   ');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 10);
    });
    expect(navigationState.replaced).toEqual(['/cars?fuel=cng']);
  });

  it('searches at once on Enter, as a new history entry', async () => {
    const { user, box } = setup();
    await user.type(box, 'hyundai   creta{Enter}');
    expect(navigationState.pushed).toEqual(['/cars?q=hyundai+creta']);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 10);
    });
    expect(navigationState.replaced).toEqual([]);
  });

  it('does not search on arrival just because the URL already has a search', async () => {
    setup({ q: 'creta' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS * 3);
    });
    expect(navigationState.replaced).toEqual([]);
    expect(navigationState.pushed).toEqual([]);
  });

  it('follows the URL when it changes underneath — Back, or a chip removed', async () => {
    const { box, view } = setup({ q: 'creta' });
    expect(box).toHaveValue('creta');

    view.rerender(<SearchToolbar params={{ q: 'venue' }} basePath="/cars" />);
    expect(box).toHaveValue('venue');
    view.rerender(<SearchToolbar params={{}} basePath="/cars" />);
    expect(box).toHaveValue('');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS * 3);
    });
    expect(navigationState.replaced).toEqual([]);
  });

  it('is a labelled search landmark', () => {
    setup();
    expect(screen.getByRole('search')).toBeInTheDocument();
  });

  it('can be left out, leaving the sort', () => {
    render(<SearchToolbar params={{}} basePath="/cars" showSearch={false} />);
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Sort cars' })).toBeInTheDocument();
  });
});

describe('the sort', () => {
  it('offers the five orders, newest first by default', () => {
    render(<SearchToolbar params={{}} basePath="/cars" />);
    const sort = screen.getByRole('combobox', { name: 'Sort cars' });
    expect(sort).toHaveValue('newest');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Newest first',
      'Price — Low to High',
      'Price — High to Low',
      'Year — Newest first',
      'Kilometers — Low to High',
    ]);
  });

  it('writes the order, keeps the filters and goes back to page one', async () => {
    const user = userEvent.setup();
    render(
      <SearchToolbar
        params={{ district: 'ranipet', fuel: 'petrol', page: '4' }}
        basePath="/cars"
      />,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort cars' }), 'price_asc');
    expect(navigationState.pushed).toEqual(['/cars?district=ranipet&fuel=petrol&sort=price_asc']);
  });

  it('leaves the default out of the URL', async () => {
    const user = userEvent.setup();
    render(<SearchToolbar params={{ sort: 'km_asc' }} basePath="/cars" />);
    expect(screen.getByRole('combobox', { name: 'Sort cars' })).toHaveValue('km_asc');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort cars' }), 'newest');
    expect(navigationState.pushed).toEqual(['/cars']);
  });

  it('reads an order it does not know as the default', () => {
    render(<SearchToolbar params={{ sort: 'cheapest' }} basePath="/cars" />);
    expect(screen.getByRole('combobox', { name: 'Sort cars' })).toHaveValue('newest');
  });
});
