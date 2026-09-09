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
 * The assertion is deliberately *not* "there is exactly one item". Each of
 * F048, F050, F051, F056 and F065 adds one as it lands, and a test that has to
 * be edited by five unrelated features is a test people stop reading. What must
 * hold at every one of those steps is that `LANDED_NAV` is a subset of
 * `DEALER_NAV` and that `/dealer/profile` — the route that exists — is in it.
 */
describe('the nav the console actually renders', () => {
  it('offers only routes that exist, and offers the one that does', () => {
    expect(LANDED_NAV.every((item) => DEALER_NAV.includes(item))).toBe(true);
    expect(LANDED_NAV.map((item) => item.href)).toContain('/dealer/profile');
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
   * And nothing at all when no route with a `short` has landed. Rendering the
   * bar anyway would pin an empty 56px white strip over the bottom of every
   * console screen on a phone — a reconstruction artefact rather than a state
   * of the product.
   */
  it('renders nothing rather than an empty bar', () => {
    const { container } = render(<ConsoleTabBar items={LANDED_NAV} />);

    expect(container).toBeEmptyDOMElement();
  });
});
