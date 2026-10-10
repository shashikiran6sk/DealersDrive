import type { PublicLocations } from '@dealers-drive/contracts';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { setLocation } from '../../../setup';

import { CustomerHeader } from '@/components/layout/customer-header';

/**
 * The buyer chrome.
 *
 * There is one rule in this component and it is the prefix match, so that is
 * what is asserted: which section is current, and — the part a colour-only
 * implementation would silently drop — that being current is announced rather
 * than only painted (DESIGN-SPEC §4.15).
 *
 * Nothing here pins the sticky offset, the hairline or the breakpoint at which
 * the nav disappears. Those are the sandbox's job; a test that fails when a
 * button's label shortens is a tax, not a check.
 *
 * The location button is the header's own tenant and has its own file —
 * `location-selector.test.tsx`. It moved there at **R22**, when it stopped
 * being a dropdown and grew a search field, a state filter and a grid: eighteen
 * tests about a dialog inside a file about a nav bar is a file about neither.
 */
const LOCATIONS: PublicLocations = {
  districts: [
    { slug: 'vellore', name: 'Vellore', count: 11, state: 'Tamil Nadu' },
    { slug: 'ranipet', name: 'Ranipet', count: 11, state: 'Tamil Nadu' },
    { slug: 'tirupattur', name: 'Tirupattur', count: 8, state: 'Tamil Nadu' },
  ],
  total: 30,
  cars: { total: 0, districts: {} },
};

function current(): string[] {
  return screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent ?? '');
}

describe('which section is current', () => {
  it('marks nothing on the home page', () => {
    setLocation('/');
    render(<CustomerHeader locations={LOCATIONS} />);

    expect(current()).toEqual([]);
  });

  it.each([
    ['/cars', 'Buy cars'],
    ['/dealers', 'Dealers'],
  ])('marks %s as %s', (pathname, label) => {
    setLocation(pathname);
    render(<CustomerHeader locations={LOCATIONS} />);

    expect(current()).toEqual([label]);
  });

  /**
   * The reason it is a prefix match rather than an exact one: a portfolio and a
   * vehicle page are two segments deeper than the section they belong to, and
   * the reader has not left it.
   */
  it('keeps the section lit two segments deep', () => {
    setLocation('/dealers/sri-lakshmi-motors');
    render(<CustomerHeader locations={LOCATIONS} />);

    expect(current()).toEqual(['Dealers']);
  });

  /** Colour is not the claim — `aria-current` is, and a class alone is not it. */
  it('announces the current section rather than only painting it', () => {
    setLocation('/cars');
    render(<CustomerHeader locations={LOCATIONS} />);

    expect(screen.getByRole('link', { name: 'Buy cars' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dealers' })).not.toHaveAttribute('aria-current');
  });
});

/**
 * The revamp moves Saved cars out of the top bar: a signed-in customer reaches
 * it from the account menu (`header-account.test.tsx`), and everybody from the
 * footer's Buy a car column. The page and its sign-in redirect are unchanged.
 */
describe('saved cars', () => {
  it('is not a top-level header link', () => {
    setLocation('/saved');
    render(<CustomerHeader locations={LOCATIONS} />);

    expect(screen.queryByRole('link', { name: 'Saved cars' })).not.toBeInTheDocument();
    expect(current()).toEqual([]);
  });
});

describe('the login door', () => {
  it('offers mobile admin and dealer sign-in and support while preserving marketplace links', async () => {
    setLocation('/');
    render(<CustomerHeader locations={LOCATIONS} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open Main menu' }));
    const drawer = await screen.findByRole('dialog');
    for (const [name, href] of [
      ['Home', '/'],
      ['Buy cars', '/cars'],
      ['Dealers', '/dealers'],
      ['Dealer login', '/login?as=dealer'],
      ['Admin login', '/admin/login'],
      ['Help and support', '/contact'],
    ]) {
      expect(within(drawer).getByRole('link', { name })).toHaveAttribute('href', href);
    }
    await user.click(within(drawer).getByRole('link', { name: 'Admin login' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
  });
  /**
   * **R63** replaced the dealer door. The header used to say "Dealer login"
   * and go to `/dealer`, because only dealers had accounts; now buyers do too,
   * so it says "Login" at every width and goes to `/login`, where the Customer
   * tab is the default and the Dealer tab is one click away.
   */
  it('says Login and points at the unified login', () => {
    setLocation('/');
    render(<CustomerHeader locations={LOCATIONS} />);

    expect(screen.getByRole('link', { name: /^login$/i })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: /dealer login/i })).not.toBeInTheDocument();
  });

  /** Still one door (**R35**), and still no "List your cars" beside it. */
  it('offers only one of them', () => {
    setLocation('/');
    render(<CustomerHeader locations={LOCATIONS} />);

    const doors = screen
      .getAllByRole('link')
      .filter((link) => ['/login', '/dealer'].includes(link.getAttribute('href') ?? ''));

    expect(doors).toHaveLength(1);
    expect(screen.queryByRole('link', { name: /list (your )?cars/i })).not.toBeInTheDocument();
  });
});
