import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { setLocation } from '../../../setup';

import { ConsoleNav, ConsoleTabBar, DEALER_NAV, LANDED_NAV } from '@/components/dealer/console-nav';

/**
 * R31 — the dealer console's nav, and the one rule in it worth a test.
 *
 * What is asserted is which item is *current*, because that is the whole of
 * what these components decide: the items arrive as a prop and the styling is
 * `.dd-nav-item` in the stylesheet. Everything about how they look belongs to
 * the sandbox.
 */
describe('ConsoleNav', () => {
  beforeEach(() => setLocation('/dealer'));

  const current = (): string[] =>
    [...document.querySelectorAll('[aria-current="true"]')].map((node) => node.textContent ?? '');

  /**
   * `/dealer` is a prefix of every console path, so a uniform "starts with"
   * rule would light Dashboard on every screen in the console. It matches
   * exactly; everything else matches by prefix.
   */
  it('matches the dashboard exactly and everything else by prefix', () => {
    setLocation('/dealer');
    const { unmount } = render(<ConsoleNav items={DEALER_NAV} />);
    expect(current()).toEqual(['Dashboard']);
    unmount();

    setLocation('/dealer/profile');
    render(<ConsoleNav items={DEALER_NAV} />);
    expect(current()).toEqual(['Dealer profile']);
  });

  /**
   * The prefix half, on the case it exists for: a nav that went blank the
   * moment a dealer opened a record would go blank exactly when they most want
   * to know where they are.
   */
  it('keeps the section lit on a record beneath it', () => {
    setLocation('/dealer/inventory/3c8f2b10-2222');
    render(<ConsoleNav items={DEALER_NAV} />);

    expect(current()).toEqual(['Inventory']);
  });

  it('lights nothing on a path under no item, rather than lighting Dashboard', () => {
    setLocation('/dealer/saved-searches');
    render(<ConsoleNav items={DEALER_NAV} />);

    expect(current()).toEqual([]);
  });
});

/**
 * The reconstruction's own half. `DEALER_NAV` is the baseline's six items and
 * is what the component is for; `LANDED_NAV` is the subset whose routes exist,
 * and the shell renders that one — a nav item onto a 404 is the console saying
 * a page exists and then not having it.
 *
 * The assertion is deliberately *not* "there are exactly n items". Each of
 * F050, F051, F056 and F065 adds one as it lands, and a test that has to be
 * edited by four unrelated features is a test people stop reading. What must
 * hold at every one of those steps is that `LANDED_NAV` is a subset of
 * `DEALER_NAV` and that the routes which exist are in it.
 */
describe('the nav the console actually renders', () => {
  it('offers only routes that exist, and offers the ones that do', () => {
    expect(LANDED_NAV.every((item) => DEALER_NAV.includes(item))).toBe(true);
    expect(LANDED_NAV.map((item) => item.href)).toContain('/dealer/profile');
    // **F048.** `/dealer` was held back until there was a page under it.
    expect(LANDED_NAV.map((item) => item.href)).toContain('/dealer');
  });

  it('keeps the order the baseline declares', () => {
    expect(LANDED_NAV.map((item) => item.href)).toEqual(
      DEALER_NAV.map((item) => item.href).filter((href) =>
        LANDED_NAV.some((item) => item.href === href),
      ),
    );
  });
});

describe('ConsoleTabBar', () => {
  beforeEach(() => setLocation('/dealer/inventory'));

  /**
   * Five tabs, not six: an item earns one by having a `short`, and `Dealer
   * profile` has none. Below 768 it stays out of a bar a thumb has to hit.
   */
  it('shows the five items that carry a short label', () => {
    render(<ConsoleTabBar items={DEALER_NAV} />);

    expect(screen.getAllByRole('link')).toHaveLength(5);
    expect(screen.getByText('Stock')).toBeInTheDocument();
    expect(screen.queryByText('Dealer profile')).toBeNull();
  });

  /**
   * And nothing at all when it is handed nothing. Rendering the bar anyway
   * would pin an empty 56px white strip over the bottom of every console screen
   * on a phone — a reconstruction artefact rather than a state of the product.
   */
  it('renders nothing rather than an empty bar', () => {
    const { container } = render(<ConsoleTabBar items={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  /**
   * ── The reconstruction accommodation (F048) ────────────────────────────────
   * The sidebar is `hidden md:flex`, so below 768 this bar is the *only*
   * navigation the console has. Applying §3.11's rule literally today — "the
   * five items carrying a `short`" — would give a phone one tab and no way to
   * reach `/dealer/profile` at all.
   *
   * So while the bar is short of its five, the items without a `short` keep a
   * place in it. The two cases below are the two ends of that: what a dealer
   * gets on a phone today, and that the accommodation costs nothing once the
   * console is complete.
   * ──────────────────────────────────────────────────────────────────────────
   */
  it('keeps every console screen reachable while the bar is under-full', () => {
    render(<ConsoleTabBar items={LANDED_NAV} />);

    const labels = screen.getAllByRole('link').map((link) => link.textContent);

    expect(labels).toContain('Home');
    expect(labels).toContain('Dealer profile');
  });

  it('falls back to the five the spec draws, the moment they all exist', () => {
    render(<ConsoleTabBar items={DEALER_NAV} />);

    expect(screen.getAllByRole('link')).toHaveLength(5);
    expect(screen.queryByText('Dealer profile')).toBeNull();
  });
});
