import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as media from '../../../../src/modules/media/media.facade.js';

/**
 * §5.5 rule 3 for photos.
 *
 * A vehicle DTO has to render a photo's status, so `toMediaStatus` — the map
 * from a stored status onto the one a dealer is shown — crosses the boundary.
 * The processing pipeline behind it does not: nothing outside this module
 * should be able to start, retry or inspect a derivative job.
 */

const SRC = new URL('../../../../src/', import.meta.url).pathname;

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('the exported surface', () => {
  it('exposes only the status mapper at runtime', () => {
    expect(Object.keys(media)).toEqual(['toMediaStatus']);
  });

  it('maps a stored status onto one a dealer can act on', () => {
    expect(typeof media.toMediaStatus('READY')).toBe('string');
  });

  /** Nothing that touches bytes or jobs crosses the line. */
  it('exposes no pipeline operation', () => {
    for (const name of Object.keys(media)) {
      expect(name).not.toMatch(/process|derive|upload|presign|commit|retry/i);
    }
  });
});

describe('the boundary holds across the codebase', () => {
  it('lets no module outside media import the media service', () => {
    const offenders = filesUnder(SRC)
      .filter((path) => !path.includes('/modules/media/'))
      .filter((path) => !path.endsWith('container.ts'))
      .filter((path) => !path.includes('/platform/jobs/'))
      .filter((path) => /from '[^']*media\/media\.service\.js'/.test(readFileSync(path, 'utf8')));

    expect(offenders.map((path) => path.replace(SRC, 'src/'))).toEqual([]);
  });

  /*
   * ── Reconstruction slice ────────────────────────────────────────────────
   * `it('allows the job handlers to drive the pipeline')` reads
   * `platform/jobs/handlers.ts`, which does not exist: its `HandlerDeps` names
   * five services that are not built yet, so the file lands with the last of
   * them (see the F031 entry). The exception it documents is already carved
   * out of the filter above — `/platform/jobs/` is excluded — so the boundary
   * rule below it is enforced today; only the positive assertion waits.
   */
});
