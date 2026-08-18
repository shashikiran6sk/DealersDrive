import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as billing from '../../../../src/modules/billing/billing.facade.js';

/**
 * ARCHITECTURE §5.5 rule 3, and the most important instance of it.
 *
 * CLAUDE.md rule 4: **`moveCredits` is the only way a balance changes.** That
 * claim is only checkable by reading one file if the rest of the codebase
 * actually goes through this file — so this test does two things. It pins the
 * exported surface, and it walks `src/` to prove no module outside `billing`
 * reaches past the facade into `credits.service` directly.
 *
 * Without the second half the facade is a suggestion. A single
 * `import { creditLedger } from '../billing/credits.service.js'` elsewhere
 * would make "every movement writes a transaction" unverifiable, and it would
 * look like an ordinary import in review.
 */

const SRC = new URL('../../../../src/', import.meta.url).pathname;

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('the exported surface', () => {
  it('exposes exactly the credit operations other modules may reach', () => {
    expect(Object.keys(billing).sort()).toEqual(
      [
        'InsufficientCreditsError',
        'currentBalance',
        'moveCredits',
        'refreshActiveListings',
        'refreshHeldCount',
      ].sort(),
    );
  });

  it('exports moveCredits as a function, not a type', () => {
    expect(typeof billing.moveCredits).toBe('function');
  });

  /**
   * One writer. `currentBalance` reads, the two `refresh*` helpers recompute
   * caches from the ledger, and `moveCredits` is the only thing that appends a
   * row. Anything else that wrote would need a name here to be reachable.
   */
  it('exposes exactly one writer', () => {
    const writers = Object.keys(billing).filter((name) =>
      /^(move|grant|debit|credit|set)/.test(name),
    );

    expect(writers).toEqual(['moveCredits']);
  });

  it('exposes the error a caller has to handle when the balance is short', () => {
    expect(typeof billing.InsufficientCreditsError).toBe('function');
  });
});

describe('the boundary holds across the codebase', () => {
  const sources = filesUnder(SRC).filter((path) => !path.includes('/modules/billing/'));

  /** The check that makes the facade a boundary rather than a convention. */
  it('lets no module outside billing import credits.service directly', () => {
    const offenders = sources.filter((path) =>
      /from '[^']*billing\/credits\.service\.js'/.test(readFileSync(path, 'utf8')),
    );

    expect(offenders.map((path) => path.replace(SRC, 'src/'))).toEqual([]);
  });

  it('lets no module outside billing import billing.service directly', () => {
    const offenders = sources
      .filter((path) => !path.endsWith('container.ts'))
      .filter((path) =>
        /from '[^']*billing\/billing\.service\.js'/.test(readFileSync(path, 'utf8')),
      );

    expect(offenders.map((path) => path.replace(SRC, 'src/'))).toEqual([]);
  });

  /**
   * The composition root is the deliberate exception: it constructs every
   * service by hand, which is the whole point of having one.
   */
  it('allows the composition root to construct the service', () => {
    expect(readFileSync(join(SRC, 'container.ts'), 'utf8')).toContain(
      "from './modules/billing/billing.service.js'",
    );
  });

  it('is actually imported by the modules that spend credits', () => {
    const importers = filesUnder(SRC).filter((path) =>
      /from '[^']*billing\.facade\.js'/.test(readFileSync(path, 'utf8')),
    );

    expect(importers.length).toBeGreaterThan(0);
  });
});
