import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as catalog from '../../../../src/modules/catalog/catalog.facade.js';

/**
 * §5.5 rule 3 for `catalog`.
 *
 * Only the repository *type*: two modules need to look up a make or a model, and both do it through the same scoped repository rather than reaching for prisma.
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
    expect(Object.keys(catalog)).toEqual([]);
  });
});

describe('the boundary holds across the codebase', () => {
  it('lets no module outside catalog import its service', () => {
    const offenders = filesUnder(SRC)
      .filter((path) => !path.includes('/modules/catalog/'))
      .filter((path) => !path.endsWith('container.ts'))
      .filter((path) =>
        new RegExp(`from '[^']*(${'catalog.service|catalog.repository'})\\.js'`).test(
          readFileSync(path, 'utf8'),
        ),
      );

    expect(offenders.map((path) => path.replace(SRC, 'src/'))).toEqual([]);
  });

  /**
   * The composition root constructs every service by hand and passes the
   * repositories down as arguments. That is what makes the dependency graph
   * greppable, and it is the one place allowed to reach inside.
   */
  it('allows the composition root to construct it', () => {
    expect(readFileSync(join(SRC, 'container.ts'), 'utf8')).toContain('modules/catalog/');
  });
});
