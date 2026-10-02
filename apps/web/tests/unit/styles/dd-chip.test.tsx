import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import type { DealerEnquiriesResponse, DealerInventoryResponse } from '@dealers-drive/contracts';
import { describe, expect, it } from 'vitest';

import { EnquiryInbox } from '@/features/dealer/enquiries';
import { InventoryView } from '@/features/dealer/inventory';

/**
 * The filter chips on the dealer inventory and the dealer enquiries (`.dd-chip`).
 *
 * The selected chip is white text on the accent (near-black) ground. The hover
 * rule used to set the text to ink with a higher specificity than the selected
 * rule, so hovering the selected chip drew ink on black: the label vanished. The
 * fix is in the shared primitive, not on either page. jsdom does no cascade, so
 * what is pinned here is the rule itself, and that both pages draw their chips
 * with it and mark the selected one the way the rule reads.
 */
const css = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

const SELECTED = ["[aria-pressed='true']", "[aria-current='true']", "[aria-current='page']"];

function rules(prefix: string): { selector: string; body: string }[] {
  const found: { selector: string; body: string }[] = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of css.matchAll(pattern)) {
    const selector = (match[1] ?? '').replace(/\s+/g, ' ').trim();
    if (selector.startsWith(prefix)) found.push({ selector, body: match[2] ?? '' });
  }
  return found;
}

describe('.dd-chip in every interactive state', () => {
  it('never recolours the selected chip’s text on hover', () => {
    const hovers = rules('.dd-chip').filter((rule) => rule.selector.includes(':hover'));
    expect(hovers.length).toBeGreaterThan(0);
    for (const rule of hovers) {
      if (!/color:\s*var\(--color-ink\)/.test(rule.body)) continue;
      for (const state of SELECTED) expect(rule.selector, rule.selector).toContain(state);
      expect(rule.selector).toMatch(/:not\(/);
    }
  });

  it('keeps the selected chip white on the accent, and only darkens its ground on hover', () => {
    const selected = rules('.dd-chip[aria-pressed').find((rule) =>
      rule.selector.includes("[aria-current='page']"),
    );
    expect(selected?.body).toMatch(/background:\s*var\(--color-accent\)/);
    expect(selected?.body).toMatch(/color:\s*#fff/);

    const selectedHover = rules('.dd-chip:is(').find((rule) => rule.selector.includes(':hover'));
    expect(selectedHover?.body).toMatch(/background:\s*var\(--color-neutral-800\)/);
    expect(selectedHover?.body).not.toMatch(/(^|[^-])color:/);
  });

  it('uses no !important to get there', () => {
    for (const rule of rules('.dd-chip')) expect(rule.body).not.toContain('!important');
  });
});

const INVENTORY: DealerInventoryResponse = {
  data: [],
  page: { nextCursor: null, hasMore: false },
  counts: { ALL: 3, ACTIVE: 2, RESERVED: 1 },
};

describe('the pages that draw them', () => {
  it('draws the inventory status filters as chips, the selected one aria-current', () => {
    render(<InventoryView inventory={INVENTORY} status="ACTIVE" />);
    const tabs = within(screen.getByRole('navigation', { name: 'Filter by status' }));
    const selected = tabs.getByRole('link', { current: 'page' });
    expect(selected).toHaveClass('dd-chip');
    expect(selected).toHaveTextContent(/Active/);
    for (const link of tabs.getAllByRole('link')) expect(link).toHaveClass('dd-chip');
  });

  it('draws the enquiry status filters as chips, the selected one aria-current', () => {
    const inbox: DealerEnquiriesResponse = {
      data: [],
      page: { nextCursor: null, hasMore: false },
      counts: { ALL: 4, NEW: 2, CONTACTED: 1, CLOSED: 1, SPAM: 0 },
    };
    render(<EnquiryInbox inbox={inbox} status="CONTACTED" />);
    const tabs = within(screen.getByRole('navigation', { name: 'Filter by status' }));
    const selected = tabs.getByRole('link', { current: 'page' });
    expect(selected).toHaveClass('dd-chip');
    for (const link of tabs.getAllByRole('link')) expect(link).toHaveClass('dd-chip');
  });
});
