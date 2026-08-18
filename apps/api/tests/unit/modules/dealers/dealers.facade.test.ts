import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as dealers from '../../../../src/modules/dealers/dealers.facade.js';

/**
 * §5.5 rule 3 for `dealers`.
 *
 * Repository types only. Four modules need to read a dealership — vehicles to check it is active before publishing, billing to price an order, enquiries to route a lead, search to render the card — and all four go through the same scoped repository.
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
    expect(Object.keys(dealers)).toEqual([]);
  });
});

describe('the boundary holds across the codebase', () => {
  it('lets no module outside dealers import its service', () => {
    const offenders = filesUnder(SRC)
      .filter((path) => !path.includes('/modules/dealers/'))
      .filter((path) => !path.endsWith('container.ts'))
      .filter((path) =>
        new RegExp(`from '[^']*(${'dealers.service'})\\.js'`).test(readFileSync(path, 'utf8')),
      );

    expect(offenders.map((path) => path.replace(SRC, 'src/'))).toEqual([]);
  });

  /**
   * The composition root constructs every service by hand and passes the
   * repositories down as arguments. That is what makes the dependency graph
   * greppable, and it is the one place allowed to reach inside.
   */
  it('allows the composition root to construct it', () => {
    expect(readFileSync(join(SRC, 'container.ts'), 'utf8')).toContain('modules/dealers/');
  });
});
