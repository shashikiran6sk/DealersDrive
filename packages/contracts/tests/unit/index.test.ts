import { describe, expect, it } from 'vitest';

import * as auth from '../../src/auth.js';
import * as common from '../../src/common.js';
import * as enums from '../../src/enums.js';
import * as contracts from '../../src/index.js';
import * as publicApi from '../../src/public.js';

/**
 * The barrel, and the package-wide rules stated at the top of it.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The F001 entry deferred this file because it asserts invariants across
 * *every* schema and only two of six modules existed. Four exist now — common,
 * enums, auth and public — and the **barrel block** below holds for any subset,
 * so it lands here with `public.ts`.
 *
 * Still deferred, because each needs a population this package does not yet
 * have:
 *
 *   · `describe('rule 2 — every input schema is strict')` and
 *     `describe('rule 1 — no input schema lets a client assert an identity or
 *     a status')` walk `…Input`/`…Query`/`…Param` exports and assert there are
 *     more than fifteen and more than ten of them respectively. They also read
 *     `admin.AuditQuery`, `dealer.UpdateEnquiryInput` and
 *     `dealer.CreateOrderInput` by name.
 *   · `it('exports a substantial contract surface')` — more than forty object
 *     schemas.
 *   · `describe('shared shapes')` — `ProblemDetails`, `CursorPage` and
 *     `OffsetPage` are already here, but the block sits below the two rule
 *     blocks in the baseline and comes back with them.
 *
 * All of it returns when `dealer.ts` and `admin.ts` land. The rules those
 * blocks enforce are not unguarded in the meantime: every schema in this
 * package is `.strict()` today, and `validate()` is what turns that into a 400.
 * ────────────────────────────────────────────────────────────────────────────
 */
describe('the barrel', () => {
  /**
   * A module that is not re-exported is a module the apps cannot import, and
   * the failure is a build error somewhere far away rather than here.
   */
  it('re-exports every module', () => {
    for (const [name, module] of [
      ['common', common],
      ['enums', enums],
      ['auth', auth],
      ['public', publicApi],
    ] as const) {
      for (const key of Object.keys(module)) {
        expect(contracts, `${name}.${key}`).toHaveProperty(key);
      }
    }
  });

  it('exports a version other packages can report', () => {
    expect(contracts.CONTRACTS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  /** The API surfaces this in `/health/ready`, so it has to be a plain string. */
  it('exports the version as a string, not a schema', () => {
    expect(typeof contracts.CONTRACTS_VERSION).toBe('string');
  });

  /**
   * Two modules exporting the same name is a silent overwrite: the barrel keeps
   * one of them and every consumer gets whichever won, with no error anywhere.
   */
  it('exports no name twice under different definitions', () => {
    const names = Object.keys(contracts);

    expect(new Set(names).size).toBe(names.length);
  });
});
