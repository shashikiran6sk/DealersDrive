import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as listings from '../../../../src/modules/listings/listings.facade.js';

/**
 * §5.5 rule 3 for the state machine.
 *
 * CLAUDE.md rule 5: **`transition` is the single gate every status change
 * passes through.** A module that imported `listing.state.js` directly could
 * still only call `transition` — but it could also reach the internal table
 * and reason about it, and the next edit would set a status from it. Keeping
 * the import surface to the facade is what stops that gradually.
 *
 * `displayStatus` matters for a different reason: it is derived *once*, here,
 * so two modules cannot disagree about whether a dealer's car is live.
 */

const SRC = new URL('../../../../src/', import.meta.url).pathname;

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('the exported surface', () => {
  it('exposes the gate, the predicate and the derived status, and nothing else', () => {
    expect(Object.keys(listings).sort()).toEqual(
      ['canTransition', 'displayStatus', 'transition'].sort(),
    );
  });

  it('exports all three as functions', () => {
    expect(typeof listings.transition).toBe('function');
    expect(typeof listings.canTransition).toBe('function');
    expect(typeof listings.displayStatus).toBe('function');
  });

  /** No setter escapes: a status is the result of an event, never an assignment. */
  it('exposes nothing that sets a status directly', () => {
    for (const name of Object.keys(listings)) {
      expect(name).not.toMatch(/^set|^force|^mark/);
    }
  });
});

describe('the boundary holds across the codebase', () => {
  const sources = filesUnder(SRC).filter((path) => !path.includes('/modules/listings/'));

  it('lets no module outside listings import listing.state directly', () => {
    const offenders = sources.filter((path) =>
      /from '[^']*listings\/listing\.state\.js'/.test(readFileSync(path, 'utf8')),
    );

    expect(offenders.map((path) => path.replace(SRC, 'src/'))).toEqual([]);
  });

  it('is imported by the modules that move a listing through review', () => {
    const importers = filesUnder(SRC).filter((path) =>
      /from '[^']*listings\.facade\.js'/.test(readFileSync(path, 'utf8')),
    );

    expect(importers.length).toBeGreaterThan(0);
  });
});
