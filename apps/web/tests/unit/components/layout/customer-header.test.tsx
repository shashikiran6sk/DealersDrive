import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { setLocation } from '../../../setup';

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
function current(): string[] {
  return screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent ?? '');
}

describe('which section is current', () => {
  it('marks nothing on the home page', () => {
    setLocation('/');
    render(<CustomerHeader />);

    expect(current()).toEqual([]);
  });

  it.each([
    ['/cars', 'Buy cars'],
    ['/dealers', 'Dealers'],
    ['/saved', 'Saved cars'],
  ])('marks %s as %s', (pathname, label) => {
    setLocation(pathname);
    render(<CustomerHeader />);

    expect(current()).toEqual([label]);
  });

  /**
   * The reason it is a prefix match rather than an exact one: a portfolio and a
   * vehicle page are two segments deeper than the section they belong to, and
   * the reader has not left it.
   */
  it('keeps the section lit two segments deep', () => {
    setLocation('/dealers/sri-lakshmi-motors');
    render(<CustomerHeader />);

    expect(current()).toEqual(['Dealers']);
  });

  /** Colour is not the claim — `aria-current` is, and a class alone is not it. */
  it('announces the current section rather than only painting it', () => {
    setLocation('/cars');
    render(<CustomerHeader />);

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
    render(<CustomerHeader />);

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
