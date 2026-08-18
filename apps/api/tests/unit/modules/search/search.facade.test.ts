import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as search from '../../../../src/modules/search/search.facade.js';

/**
 * §5.5 rule 3 for the read model.
 *
 * `listing_search` is the single visibility rule, so the tempting shortcut is
 * for another module to query it directly — admin wanting a count, catalog
 * wanting a "from ₹x". Every such query would be a second place that decides
 * what is public. The facade exposes the repository *type* and one label
 * function; how search works stays inside.
 */

const SRC = new URL('../../../../src/', import.meta.url).pathname;

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('the exported surface', () => {
  it('exposes only the body-type label at runtime', () => {
    expect(Object.keys(search)).toEqual(['bodyTypeLabel']);
  });

  it('renders a stored enum as something a moderation card can show', () => {
    expect(search.bodyTypeLabel('HATCHBACK')).not.toContain('_');
    expect(search.bodyTypeLabel('HATCHBACK')).not.toBe('HATCHBACK');
  });

  /** The service itself never leaves the module — only its repository type does. */
  it('exposes no query function', () => {
    for (const name of Object.keys(search)) {
      expect(name).not.toMatch(/search|query|find|count/i);
    }
  });
});

describe('the boundary holds across the codebase', () => {
  const sources = filesUnder(SRC).filter((path) => !path.includes('/modules/search/'));

  it('lets no module outside search import the search service', () => {
    const offenders = sources
      .filter((path) => !path.endsWith('container.ts'))
      .filter((path) => /from '[^']*search\/search\.service\.js'/.test(readFileSync(path, 'utf8')));

    expect(offenders.map((path) => path.replace(SRC, 'src/'))).toEqual([]);
  });

  it('lets no module outside search import the mapper directly', () => {
    const offenders = sources.filter((path) =>
      /from '[^']*search\/search\.mapper\.js'/.test(readFileSync(path, 'utf8')),
    );

    expect(offenders.map((path) => path.replace(SRC, 'src/'))).toEqual([]);
  });
});
