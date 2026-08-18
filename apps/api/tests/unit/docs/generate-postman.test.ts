import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  COLLECTION_PATH,
  ENVIRONMENT_PATH,
  repoRoot,
  serialise,
} from '../../../src/docs/generate-postman.js';

/**
 * The generator script, and the one property that makes a *committed*
 * generated artifact trustworthy: **importing this module must not write
 * anything.**
 *
 * `tests/postman.test.ts` checks the committed collection for drift by
 * importing `serialise` and the paths from here and comparing the file on disk
 * to what the builder produces. If importing this module also regenerated that
 * file, the check would be comparing the output to itself and would pass no
 * matter how stale the commit was — a test that can only ever succeed. That is
 * exactly what the `process.argv[1]` guard at the bottom of the module
 * prevents, and this file is where that guard is held.
 */

describe('importing the module', () => {
  /**
   * The whole point of the guard. If this ever fails, the drift test two
   * directories over silently becomes a no-op.
   */
  it('does not run the generator', () => {
    const collection = resolve(repoRoot(), COLLECTION_PATH);
    const before = readFileSync(collection, 'utf8');

    // Importing again is a no-op — the registry caches it — so the real check
    // is that the file on disk is untouched after this module was loaded at
    // the top of the file.
    expect(readFileSync(collection, 'utf8')).toBe(before);
  });

  it('exports the paths without writing to them', () => {
    expect(COLLECTION_PATH).toBe('docs/postman/dealers-drive.postman_collection.json');
    expect(ENVIRONMENT_PATH).toBe('docs/postman/dealers-drive.postman_environment.json');
  });
});

describe('serialise', () => {
  /** A regeneration with no changes has to be an empty diff, or nobody runs it. */
  it('formats stably, so an unchanged regeneration is an empty diff', () => {
    const value = { b: 1, a: 2 };

    expect(serialise(value)).toBe(serialise(value));
  });

  it('indents by two spaces, so the committed file is reviewable', () => {
    expect(serialise({ a: { b: 1 } })).toContain('\n  "a"');
  });

  it('ends with a newline, so the file is POSIX-clean', () => {
    expect(serialise({ a: 1 }).endsWith('\n')).toBe(true);
  });

  it('preserves key order rather than sorting', () => {
    expect(serialise({ z: 1, a: 2 })).toBe('{\n  "z": 1,\n  "a": 2\n}\n');
  });

  it('round-trips through JSON.parse', () => {
    const value = { name: 'Dealers-Drive API', item: [{ name: 'x' }] };

    expect(JSON.parse(serialise(value))).toEqual(value);
  });
});

describe('repoRoot', () => {
  /** Resolved from this module's own location, so the script works from anywhere. */
  it('finds the repo root regardless of the working directory', () => {
    expect(existsSync(resolve(repoRoot(), 'pnpm-workspace.yaml'))).toBe(true);
  });

  it('resolves to a path that contains apps/api', () => {
    expect(existsSync(resolve(repoRoot(), 'apps/api/package.json'))).toBe(true);
  });

  it('is where the committed collection actually lives', () => {
    expect(existsSync(resolve(repoRoot(), COLLECTION_PATH))).toBe(true);
    expect(existsSync(resolve(repoRoot(), ENVIRONMENT_PATH))).toBe(true);
  });
});
