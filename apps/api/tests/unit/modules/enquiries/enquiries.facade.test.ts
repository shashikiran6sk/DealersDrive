import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as enquiries from '../../../../src/modules/enquiries/enquiries.facade.js';

/**
 * §5.5 rule 3 for `enquiries`.
 *
 * Only the repository type: the dealer profile's median response time is computed from leads, and that is the one thing another module legitimately needs from this one.
 *
 * A type-only facade emits no JavaScript, so there is nothing to unit test in
 * the usual sense — but the boundary it draws is real, and that is checkable:
 * the module's internals must not be imported from outside it.
 */

const SRC = new URL('../../../../src/', import.meta.url).pathname;

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('the exported surface', () => {
  /** Types only — the module exposes a vocabulary, not behaviour. */
  it('exports nothing at runtime', () => {
    expect(Object.keys(enquiries)).toEqual([]);
  });
});

describe('the boundary holds across the codebase', () => {
  it('lets no module outside enquiries import its service', () => {
    const offenders = filesUnder(SRC)
      .filter((path) => !path.includes('/modules/enquiries/'))
      .filter((path) => !path.endsWith('container.ts'))
      .filter((path) =>
        new RegExp(`from '[^']*(${'enquiries.service'})\\.js'`).test(readFileSync(path, 'utf8')),
      );

    expect(offenders.map((path) => path.replace(SRC, 'src/'))).toEqual([]);
  });

  /**
   * The composition root constructs every service by hand and passes the
   * repositories down as arguments. That is what makes the dependency graph
   * greppable, and it is the one place allowed to reach inside.
   */
  it('allows the composition root to construct it', () => {
    expect(readFileSync(join(SRC, 'container.ts'), 'utf8')).toContain('modules/enquiries/');
  });
});
