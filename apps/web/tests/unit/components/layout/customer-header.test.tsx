import type { PublicLocations } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { navigationState, setLocation } from '../../../setup';

import { CustomerFooter } from '@/components/layout/customer-footer';
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
 */
const LOCATIONS: PublicLocations = {
  districts: [
    { slug: 'vellore', name: 'Vellore', count: 11 },
    { slug: 'ranipet', name: 'Ranipet', count: 11 },
    { slug: 'tirupattur', name: 'Tirupattur', count: 8 },
  ],
  total: 30,
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
    ['/saved', 'Saved cars'],
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

describe('the two dealer doors', () => {
  /**
   * Both go to `/dealer`. The console decides between "sign in" and "finish
   * onboarding" from the session, so the header never has to guess which of the
   * two a visitor needs — and therefore cannot get it wrong.
   */
  it('points both at the same door', () => {
    setLocation('/');
    render(<CustomerHeader locations={LOCATIONS} />);

    for (const name of [/dealer login|^login$/i, /list (your )?cars/i]) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', '/dealer');
    }
  });
});

describe('the footer', () => {
  it('carries the sentence the marketplace rests on', () => {
    render(<CustomerFooter />);

    expect(screen.getByText(/owned, priced and warranted by the dealer/i)).toBeInTheDocument();
  });

  it('links the four buyer destinations', () => {
    render(<CustomerFooter />);
    const footer = screen.getByRole('navigation', { name: /footer/i });

    expect(
      Array.from(footer.querySelectorAll('a')).map((link) => link.getAttribute('href')),
    ).toEqual(['/cars', '/dealers', '/saved', '/dealer']);
  });
});

/**
 * The header's location button.
 *
 * It lists **districts**, not cities. A district is the area somebody would
 * drive across, the towns inside it give no hint they are related, and a
 * dropdown of every town on the platform stops being readable at about thirty.
 * The towns are the directory's chips, narrowed to whatever is chosen here.
 */
describe('the location selector', () => {
  beforeEach(() => {
    navigationState.pushed.length = 0;
  });

  it('reads "All districts" until one is chosen, and the district after', () => {
    setLocation('/dealers');
    const { unmount } = render(<CustomerHeader locations={LOCATIONS} />);
    expect(screen.getByRole('button', { name: /all districts/i })).toBeInTheDocument();
    unmount();

    setLocation('/dealers', 'district=ranipet');
    render(<CustomerHeader locations={LOCATIONS} />);
    expect(screen.getByRole('button', { name: /ranipet/i })).toBeInTheDocument();
  });

  it('offers every district, counted, plus the way back to all of them', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<CustomerHeader locations={LOCATIONS} />);

    await user.click(screen.getByRole('button', { name: /all districts/i }));

    expect(screen.getAllByRole('option').map((row) => row.textContent)).toEqual([
      'All districts30',
      'Vellore11',
      'Ranipet11',
      'Tirupattur8',
    ]);
  });

  /**
   * `?district=ranipet&city=katpadi` is an empty page — Katpadi is in Vellore.
   * Rather than let a buyer navigate into that and wonder what they did,
   * changing the district drops the towns that belonged to the old one.
   */
  it('drops the towns and the page number when the district changes', async () => {
    setLocation('/dealers', 'district=vellore&city=katpadi,vellore&page=3&q=motors');
    const user = userEvent.setup();
    render(<CustomerHeader locations={LOCATIONS} />);

    await user.click(screen.getByRole('button', { name: /vellore/i }));
    await user.click(screen.getByRole('option', { name: /ranipet/i }));

    // The name search survives: it is about the dealership, not the place.
    expect(navigationState.pushed).toEqual(['/dealers?district=ranipet&q=motors']);
  });

  it('goes back to every district', async () => {
    setLocation('/dealers', 'district=vellore');
    const user = userEvent.setup();
    render(<CustomerHeader locations={LOCATIONS} />);

    await user.click(screen.getByRole('button', { name: /vellore/i }));
    await user.click(screen.getByRole('option', { name: /all districts/i }));

    expect(navigationState.pushed).toEqual(['/dealers']);
  });

  /**
   * Choosing a place from the home page is a person saying where they are, and
   * the useful answer is the dealerships there — not the same home page with a
   * query string on it that nothing reads.
   */
  it('sends a visitor from anywhere else to the directory', async () => {
    setLocation('/');
    const user = userEvent.setup();
    render(<CustomerHeader locations={LOCATIONS} />);

    await user.click(screen.getByRole('button', { name: /all districts/i }));
    await user.click(screen.getByRole('option', { name: /tirupattur/i }));

    expect(navigationState.pushed).toEqual(['/dealers?district=tirupattur']);
  });

  it('closes on Escape and hands focus back to the button', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<CustomerHeader locations={LOCATIONS} />);

    const trigger = screen.getByRole('button', { name: /all districts/i });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  /**
   * The API is allowed to be unreachable — the layout degrades to an empty list
   * rather than letting a throw take the whole document to `global-error`. The
   * button still has to be a button.
   */
  it('still renders when there are no districts to offer', async () => {
    setLocation('/dealers');
    const user = userEvent.setup();
    render(<CustomerHeader locations={{ districts: [], total: 0 }} />);

    await user.click(screen.getByRole('button', { name: /all districts/i }));

    expect(screen.getAllByRole('option')).toHaveLength(1);
  });
});
