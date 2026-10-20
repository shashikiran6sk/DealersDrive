import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { navigationState } from '../../../setup';

import {
  SearchNavigationProvider,
  revealAnchor,
  useSearchNavigation,
} from '@/components/search/search-navigation';

function Apply({ href }: { href: string }) {
  const { navigate } = useSearchNavigation();
  return (
    <button type="button" onClick={() => navigate(href)}>
      Apply
    </button>
  );
}

function placeAnchor(top: number) {
  const target = document.createElement('section');
  target.id = 'inventory';
  target.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: top, width: 100, height: 100 });
  const scrollIntoView = vi.fn();
  target.scrollIntoView = scrollIntoView;
  document.body.append(target);
  return scrollIntoView;
}

afterEach(() => {
  document.getElementById('inventory')?.remove();
  navigationState.pushed.length = 0;
});

describe('revealAnchor', () => {
  it('scrolls to the anchor only when it has gone above the viewport', () => {
    const scrolled = placeAnchor(-420);
    revealAnchor('inventory');
    expect(scrolled).toHaveBeenCalledWith({ block: 'start' });
  });

  it('leaves the page alone while the anchor is still on screen or below it', () => {
    const scrolled = placeAnchor(120);
    revealAnchor('inventory');
    revealAnchor('missing');
    expect(scrolled).not.toHaveBeenCalled();
  });
});

describe('SearchNavigationProvider with an anchor', () => {
  it('pushes the filter URL and returns the buyer to the inventory once it settles', async () => {
    const user = userEvent.setup();
    const scrolled = placeAnchor(-900);
    render(
      <SearchNavigationProvider anchor="inventory">
        <Apply href="/dealers/sri-motors?fuel=PETROL#inventory" />
      </SearchNavigationProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await act(() => Promise.resolve());

    expect(navigationState.pushed).toEqual(['/dealers/sri-motors?fuel=PETROL#inventory']);
    expect(scrolled).toHaveBeenCalledTimes(1);
  });

  it('never scrolls a page that did not ask for an anchor', async () => {
    const user = userEvent.setup();
    const scrolled = placeAnchor(-900);
    render(
      <SearchNavigationProvider>
        <Apply href="/cars?fuel=PETROL" />
      </SearchNavigationProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await act(() => Promise.resolve());

    expect(navigationState.pushed).toEqual(['/cars?fuel=PETROL']);
    expect(scrolled).not.toHaveBeenCalled();
  });
});
