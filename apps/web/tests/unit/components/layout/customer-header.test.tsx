import type { PublicLocations } from '@dealers-drive/contracts';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { navigationState, setLocation } from '../../../setup';

import { CustomerHeader, showsLocationSelector } from '@/components/layout/customer-header';

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
  it('offers dealer sign-in and support, but no admin entry, while preserving marketplace links', async () => {
    setLocation('/');
    render(<CustomerHeader locations={LOCATIONS} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open Main menu' }));
    const drawer = await screen.findByRole('dialog');
    expect(drawer).toHaveAccessibleName('Main');
    for (const [name, href] of [
      ['Home', '/'],
      ['Buy cars', '/cars'],
      ['Dealers', '/dealers'],
      ['Dealer login', '/login?as=dealer'],
      ['Help and support', '/contact'],
    ]) {
      expect(within(drawer).getByRole('link', { name })).toHaveAttribute('href', href);
    }
    expect(within(drawer).queryByRole('link', { name: /admin/i })).toBeNull();
    await user.click(within(drawer).getByRole('link', { name: 'Dealer login' }));
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

/**
 * The drawer carries the brand: the DD mark and the wordmark on the left of its
 * header, the close button on the right, at every width — the header's own
 * wordmark is hidden below `sm`, so on a phone this is where the name is.
 */
describe('the mobile drawer brand', () => {
  async function openDrawer() {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open Main menu' }));
    return { user, drawer: await screen.findByRole('dialog', { name: 'Main' }) };
  }

  it('shows the logo and the name, linked home, left of the close button', async () => {
    setLocation('/dealers/aishwarya-cars-vellore-tamil-nadu');
    render(<CustomerHeader locations={LOCATIONS} />);
    const { drawer } = await openDrawer();

    const header = drawer.querySelector('.dd-dialog-header');
    if (!(header instanceof HTMLElement)) throw new Error('no drawer header');
    const brand = within(header).getByRole('link', { name: /Dealers-Drive/ });
    expect(brand).toHaveAttribute('href', '/');
    expect(brand.querySelector('img[src="/brand/dd-icon-black.svg"]')).toHaveAttribute(
      'src',
      '/brand/dd-icon-black.svg',
    );
    const name = brand.querySelector('img[src="/brand/dealersdrive-wordmark-black.svg"]');
    expect(name).toBeVisible();
    expect(name).not.toHaveClass('max-sm:sr-only');
    expect(name).toHaveClass('truncate');
    expect(brand).toHaveClass('min-w-0');

    const close = within(header).getByRole('button', { name: 'Close navigation' });
    expect(brand.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(close).toHaveClass('flex-none');
  });

  it('keeps every destination and the active page under the brand', async () => {
    setLocation('/dealers/aishwarya-cars-vellore-tamil-nadu');
    render(<CustomerHeader locations={LOCATIONS} />);
    const { drawer } = await openDrawer();

    const nav = within(drawer).getByRole('navigation', { name: 'Main' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Home', 'Buy cars', 'Dealers']);
    expect(within(nav).getByRole('link', { name: 'Dealers' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('closes on Escape and on the close button, returning focus to the menu button', async () => {
    setLocation('/');
    render(<CustomerHeader locations={LOCATIONS} />);
    const trigger = screen.getByRole('button', { name: 'Open Main menu' });

    const first = await openDrawer();
    await first.user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger).toHaveFocus();

    const second = await openDrawer();
    await second.user.click(
      within(second.drawer).getByRole('button', { name: 'Close navigation' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it('closes when the brand is chosen on the home page itself', async () => {
    setLocation('/');
    render(<CustomerHeader locations={LOCATIONS} />);
    const { user, drawer } = await openDrawer();

    await user.click(within(drawer).getByRole('link', { name: /Dealers-Drive/ }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps focus inside the drawer, starting with the brand', async () => {
    setLocation('/');
    render(<CustomerHeader locations={LOCATIONS} />);
    const { user, drawer } = await openDrawer();

    const focusables = [...drawer.querySelectorAll<HTMLElement>('a[href], button')];
    expect(focusables[0]).toHaveAccessibleName(/Dealers-Drive/);
    for (let press = 0; press < focusables.length + 2; press += 1) {
      await user.tab();
      expect(drawer).toContainElement(
        document.activeElement instanceof HTMLElement ? document.activeElement : null,
      );
    }
  });

  it('keeps the header wordmark for wider screens', () => {
    setLocation('/');
    render(<CustomerHeader locations={LOCATIONS} />);

    const header = screen.getByRole('banner');
    const brand = within(header).getByRole('link', { name: /Dealers-Drive/ });
    expect(brand).toHaveAttribute('href', '/');
    expect(brand.querySelector('img[src="/brand/dealersdrive-wordmark-black.svg"]')).toHaveClass(
      'max-sm:sr-only',
    );
  });
});

/**
 * The district selector belongs to the two directories and the home page that
 * leads into them. A car page and a dealership's page are each about one
 * thing; a "Select district" button there reads as a filter on a page that has
 * nothing to filter. The rule is an exact match on the pathname, so a detail
 * page two segments under `/dealers` does not inherit the directory's chrome
 * the way the nav highlight above deliberately does.
 */
describe('the district selector', () => {
  const DEALER_PAGE = '/dealers/sri-lakshmi-motors-katpadi-vellore-tamil-nadu';
  const CAR_PAGE = '/car/2023-hyundai-creta-sx-o-katpadi-3f9a1c2b';

  function selector(): HTMLElement | null {
    return screen.queryByRole('button', { name: /select district|vellore|ranipet|tirupattur/i });
  }

  function rightCluster(): HTMLElement {
    const cluster = screen.getByRole('link', { name: 'Login' }).parentElement;
    if (!(cluster instanceof HTMLElement)) throw new Error('no right cluster');
    return cluster;
  }

  it.each([['/'], ['/cars'], ['/dealers']])('is offered on %s', (pathname) => {
    setLocation(pathname);
    render(<CustomerHeader locations={LOCATIONS} />);

    expect(screen.getByRole('button', { name: /select district/i })).toBeInTheDocument();
  });

  it('names the chosen district on the directory', () => {
    setLocation('/dealers', 'district=ranipet');
    render(<CustomerHeader locations={LOCATIONS} />);

    expect(screen.getByRole('button', { name: /ranipet/i })).toBeInTheDocument();
  });

  it.each([
    ['an individual car', CAR_PAGE],
    ["a dealership's page", DEALER_PAGE],
  ])('is not offered on %s', (_, pathname) => {
    setLocation(pathname);
    render(<CustomerHeader locations={LOCATIONS} />);

    expect(selector()).toBeNull();
    expect(screen.queryByText(/select district/i)).toBeNull();
  });

  it('is not offered on a detail page even when the URL still carries a district', () => {
    setLocation(DEALER_PAGE, 'district=ranipet');
    render(<CustomerHeader locations={LOCATIONS} />);

    expect(selector()).toBeNull();
  });

  it.each([['/saved'], ['/contact'], ['/enquiries'], ['/support-requests/new'], ['/invitations']])(
    'is not offered on %s, which is not a directory',
    (pathname) => {
      setLocation(pathname);
      render(<CustomerHeader locations={LOCATIONS} />);

      expect(selector()).toBeNull();
    },
  );

  /**
   * `/car/…` and `/cars` share four letters, and every dealership's page starts
   * with `/dealers`. A prefix rule would have hidden it from the directories or
   * shown it on the detail pages; these pin it to exact segments.
   */
  it.each([
    ['/cars', true],
    ['/cars/', true],
    ['/dealers', true],
    ['/dealers/', true],
    ['/', true],
    ['/car', false],
    ['/car/', false],
    [CAR_PAGE, false],
    [`${CAR_PAGE}/`, false],
    [DEALER_PAGE, false],
    [`${DEALER_PAGE}/`, false],
    ['/dealersx', false],
    ['/carsx', false],
    ['/login', false],
    ['/dealer', false],
    ['/dealer/inventory', false],
    ['/admin', false],
    ['/sales/dealers', false],
  ])('%s → shown: %s', (pathname, shown) => {
    expect(showsLocationSelector(pathname)).toBe(shown);
  });

  it('leaves no placeholder behind: Login is all that is left in the corner', () => {
    setLocation(DEALER_PAGE);
    render(<CustomerHeader locations={LOCATIONS} />);

    const cluster = rightCluster();
    expect(cluster.children).toHaveLength(1);
    expect(cluster.firstElementChild).toBe(screen.getByRole('link', { name: 'Login' }));
  });

  it('keeps the selector first and Login last in the corner on the directory', () => {
    setLocation('/dealers');
    render(<CustomerHeader locations={LOCATIONS} />);

    const cluster = rightCluster();
    expect(cluster.children).toHaveLength(2);
    expect(cluster.firstElementChild).toBe(
      screen.getByRole('button', { name: /select district/i }),
    );
    expect(cluster.lastElementChild).toBe(screen.getByRole('link', { name: 'Login' }));
  });

  it.each([
    [CAR_PAGE, []],
    [DEALER_PAGE, ['Dealers']],
  ])('keeps the brand, the nav, the menu and Login on %s', (pathname, highlighted) => {
    setLocation(pathname);
    render(<CustomerHeader locations={LOCATIONS} />);

    const header = screen.getByRole('banner');
    expect(within(header).getAllByRole('link', { name: /Dealers-Drive/ })[0]).toHaveAttribute(
      'href',
      '/',
    );
    expect(within(header).getByRole('button', { name: 'Open Main menu' })).toBeInTheDocument();
    expect(within(header).getByRole('link', { name: 'Buy cars' })).toHaveAttribute('href', '/cars');
    expect(within(header).getByRole('link', { name: 'Dealers' })).toHaveAttribute(
      'href',
      '/dealers',
    );
    expect(within(header).getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(current()).toEqual(highlighted);
  });

  it('keeps the mobile drawer whole on a detail page', async () => {
    setLocation(CAR_PAGE);
    render(<CustomerHeader locations={LOCATIONS} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Open Main menu' }));
    const drawer = await screen.findByRole('dialog', { name: 'Main' });

    expect(
      within(within(drawer).getByRole('navigation', { name: 'Main' }))
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Home', 'Buy cars', 'Dealers']);
  });

  /**
   * The choice lives in the URL and nowhere else, so hiding the button on the
   * way through cannot lose it: back on the directory the same query string
   * names the same district, and nothing was pushed in between.
   */
  it('hands the same district back on the way from a dealership to the directory', () => {
    setLocation('/dealers', 'district=ranipet');
    const { rerender } = render(<CustomerHeader locations={LOCATIONS} />);
    expect(screen.getByRole('button', { name: /ranipet/i })).toBeInTheDocument();

    setLocation(DEALER_PAGE);
    rerender(<CustomerHeader locations={LOCATIONS} />);
    expect(selector()).toBeNull();

    setLocation('/dealers', 'district=ranipet');
    rerender(<CustomerHeader locations={LOCATIONS} />);
    expect(screen.getByRole('button', { name: /ranipet/i })).toBeInTheDocument();
    expect(navigationState.pushed).toEqual([]);
    expect(navigationState.replaced).toEqual([]);
  });

  it('still chooses a district from the directory after a visit to a car', async () => {
    setLocation(CAR_PAGE);
    const { rerender } = render(<CustomerHeader locations={LOCATIONS} />);
    expect(selector()).toBeNull();

    setLocation('/cars');
    rerender(<CustomerHeader locations={LOCATIONS} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /select district/i }));
    await user.click(screen.getByRole('button', { name: /^ranipet/i }));

    expect(navigationState.pushed).toEqual(['/cars?district=ranipet']);
  });
});
