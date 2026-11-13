import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import { Fragment, isValidElement } from 'react';
import { describe, expect, it } from 'vitest';

import { PAGE_SLOT_KEY, PageSlot } from '@/components/layout/page-slot';

/**
 * The page under a layout reaches the browser as a lazy value in the streamed
 * page data. When it was a direct child of `<main>` and resolved a moment late
 * during hydration, React re-ran `<main>` without resetting its place in the
 * server HTML, found the page's own `<div>` where `<main>` should be, raised
 * #418 and rebuilt the whole document. Measured on a throttled production
 * build: about 1 load in 6 on every public page; 0 in 96 with the page inside
 * a keyed Fragment. jsdom cannot reproduce the timing, so what is pinned here
 * is the shape: the slot is a keyed Fragment, and every layout puts its page
 * in one.
 */
const SRC = resolve(process.cwd(), 'src');

function filesNamed(dir: string, name: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return filesNamed(path, name);
    return entry === name ? [path] : [];
  });
}

describe('PageSlot', () => {
  it('renders the page it is given, adding no element of its own', () => {
    const { container } = render(
      <main>
        <PageSlot>
          <h1>Contact Dealers-Drive</h1>
        </PageSlot>
      </main>,
    );
    expect(screen.getByRole('heading', { name: 'Contact Dealers-Drive' })).toBeInTheDocument();
    expect(container.querySelector('main')?.children).toHaveLength(1);
  });

  it('is a keyed Fragment, so the page is never a bare child of the element around it', () => {
    const slot = PageSlot({ children: <p>page</p> });
    expect(isValidElement(slot)).toBe(true);
    if (!isValidElement(slot)) return;
    expect(slot.type).toBe(Fragment);
    expect(slot.key).toBe(PAGE_SLOT_KEY);
  });
});

describe('every layout that places its page inside an element', () => {
  const shells = [
    ...filesNamed(join(SRC, 'app'), 'layout.tsx'),
    join(SRC, 'components/layout/public-shell/public-shell.tsx'),
  ]
    .map((path) => ({ path: relative(SRC, path), source: readFileSync(path, 'utf8') }))
    .filter(({ source }) => /<(main|div)[^>]*>\s*(<PageSlot>)?\{children\}/.test(source));

  it('finds the five shells that frame a page', () => {
    expect(shells.map(({ path }) => path).sort()).toEqual(
      [
        'app/(admin)/admin/layout.tsx',
        'app/(auth)/layout.tsx',
        'app/(dealer)/dealer/layout.tsx',
        'app/(sales)/sales/layout.tsx',
        'components/layout/public-shell/public-shell.tsx',
      ].sort(),
    );
  });

  it.each(['main', 'div'])('never puts {children} straight inside a <%s>', (tag) => {
    for (const { path, source } of shells) {
      expect(source, path).not.toMatch(new RegExp(`<${tag}[^>]*>\\s*\\{children\\}`));
    }
  });
});
