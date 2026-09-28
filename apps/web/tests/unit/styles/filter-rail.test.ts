import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The desktop filter rail scrolls on its own (**R56**). jsdom does no layout,
 * so what is pinned here is the rule itself: the rail is sticky under the
 * header, never taller than what is left of the viewport, and scrolls inside
 * itself without dragging the page — every length derived from the header's
 * one height token rather than a number repeated per page.
 */
const read = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');

const css = read('src/styles/globals.css');

function block(name: string): string {
  const start = css.indexOf(`@utility ${name} {`);
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
}

describe('the filter rail', () => {
  it('is what both filtered pages put their panel in', () => {
    expect(read('src/app/(public)/cars/page.tsx')).toContain('lg:filter-rail');
    expect(read('src/components/dealers/dealer-inventory/dealer-inventory.tsx')).toContain(
      'lg:filter-rail',
    );
  });

  it('is sticky under the header, bounded by the viewport, and scrolls itself', () => {
    const rail = block('filter-rail');
    expect(rail).toContain('position: sticky;');
    expect(rail).toContain('top: var(--rail-top);');
    expect(rail).toContain('max-height: calc(100dvh - var(--rail-top) - var(--rail-gap));');
    expect(rail).toContain('overflow-y: auto;');
    expect(rail).toContain('overscroll-behavior: contain;');
  });

  it('derives its offset from the header height, the one the header itself uses', () => {
    expect(css).toContain('--rail-top: calc(var(--header-height) + var(--rail-gap));');
    const header = read('src/components/layout/customer-header/customer-header.tsx');
    expect(header).toContain('h-(--header-height)');
  });
});
