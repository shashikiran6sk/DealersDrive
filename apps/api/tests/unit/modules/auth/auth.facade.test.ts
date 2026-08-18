import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as auth from '../../../../src/modules/auth/auth.facade.js';

/**
 * §5.5 rule 3 for identity, and the absence here is the point.
 *
 * The facade exposes the principal *types* and the permission helpers. It
 * exposes no way to **construct** a principal. Identity is resolved by the
 * session resolver at the edge and passed inward, so a service can read who is
 * calling and can never decide it — which is the same property that makes
 * `dealerId` un-forgeable by a client.
 */

const SRC = new URL('../../../../src/', import.meta.url).pathname;

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('the exported surface', () => {
  it('exposes only the two permission helpers at runtime', () => {
    expect(Object.keys(auth).sort()).toEqual(
      ['permissionsForAdminRole', 'permissionsForRole'].sort(),
    );
  });

  /**
   * No factory, no resolver, no session constructor. A service holding one of
   * these would be able to promote itself.
   */
  it('exposes no way to construct or resolve a principal', () => {
    for (const name of Object.keys(auth)) {
      expect(name).not.toMatch(/create|resolve|make|build|sign|issue/i);
    }
  });

  it('derives permissions from a role rather than accepting a list', () => {
    expect(auth.permissionsForRole('SALES')).toContain('vehicle:read');
    expect(auth.permissionsForRole('SALES')).not.toContain('billing:purchase');
  });
});

describe('the boundary holds across the codebase', () => {
  const sources = filesUnder(SRC).filter((path) => !path.includes('/modules/auth/'));

  /**
   * The dev adapter is the one thing that turns configuration into an
   * identity. Only the composition root may reach it — anything else importing
   * it would be manufacturing a principal.
   */
  it('lets only the composition root import the session adapter', () => {
    const offenders = sources.filter(
      (path) =>
        !path.endsWith('container.ts') &&
        /from '[^']*auth\/dev-session\.adapter\.js'/.test(readFileSync(path, 'utf8')),
    );

    expect(offenders.map((path) => path.replace(SRC, 'src/'))).toEqual([]);
  });

  /**
   * `session.port.js` is imported widely for its *types* — the middleware and
   * every scoped service take a principal. That is the port, not an internal,
   * so it is allowed. What must not happen is a module reaching for the
   * adapter behind it, which the test above covers.
   */
  it('lets the middleware take a principal type from the port', () => {
    expect(readFileSync(join(SRC, 'middleware/auth.ts'), 'utf8')).toContain('session.port.js');
  });
});
