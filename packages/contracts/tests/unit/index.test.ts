import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import * as contracts from '../../src/index.js';
import * as admin from '../../src/admin.js';
import * as common from '../../src/common.js';
import * as dealer from '../../src/dealer.js';
import * as enums from '../../src/enums.js';
import * as publicApi from '../../src/public.js';

/**
 * The barrel, and the two package-wide rules stated at the top of it. Both are
 * checked here across *every* schema rather than one file at a time, because
 * both are the kind of rule that holds until someone adds one more schema.
 *
 *   1. Every input schema is `.strict()`. An unknown field is a 400, never a
 *      silent ignore (CLAUDE.md rule 2) — silent ignoring is how a frontend
 *      typo survives for months.
 *
 *   2. No input schema lets a client assert `dealerId`, a listing `status` or
 *      a `slug`. Those come from the session and from the state machine
 *      (rules 1 and 5). A schema that accepted `dealerId` would make tenant
 *      isolation a matter of every handler remembering to ignore it.
 *
 * "Input" is read off the name: `…Input`, `…Query` and `…Param` are the shapes
 * a client sends. Rule 2 carries two exemptions that are stated and checked
 * where they apply, rather than left as quiet holes.
 */

/**
 * The exports are walked at runtime rather than listed, so a schema added
 * tomorrow is checked by these rules without anyone remembering to add it.
 */
type AnyZodObject = z.ZodObject<z.ZodRawShape>;

const INPUT_SUFFIXES = /(Input|Query|Param)$/;

function objectSchemas(predicate: (name: string) => boolean): [string, AnyZodObject][] {
  return Object.entries(contracts).flatMap(([name, value]) =>
    predicate(name) && value instanceof z.ZodObject ? [[name, value as AnyZodObject]] : [],
  );
}

const inputSchemas = objectSchemas((name) => INPUT_SUFFIXES.test(name));
const allObjectSchemas = objectSchemas(() => true);

/** A strict object rejects a key it does not declare. Cheaper to observe than to introspect. */
function isStrict(schema: AnyZodObject): boolean {
  return !schema.safeParse({ __surely_not_a_real_field__: 1 }).success;
}

describe('the barrel', () => {
  it('re-exports every module', () => {
    for (const [name, module] of [
      ['common', common],
      ['enums', enums],
      ['public', publicApi],
      ['dealer', dealer],
      ['admin', admin],
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

  it('exports no name twice under different definitions', () => {
    const names = Object.keys(contracts);

    expect(new Set(names).size).toBe(names.length);
  });

  it('exports a substantial contract surface', () => {
    expect(allObjectSchemas.length).toBeGreaterThan(40);
  });
});

describe('rule 2 — every input schema is strict', () => {
  it('finds input schemas to check', () => {
    expect(inputSchemas.length).toBeGreaterThan(15);
  });

  /**
   * The failure this prevents is specific: `?lmit=5` silently returning page
   * one at the default limit, and a frontend bug going unnoticed because the
   * response looked fine.
   */
  it.each(inputSchemas)('%s rejects an unknown field', (_name, schema) => {
    expect(isStrict(schema)).toBe(true);
  });

  it('applies the rule to every naming convention a client sends', () => {
    const names = inputSchemas.map(([name]) => name);

    expect(names.some((name) => name.endsWith('Input'))).toBe(true);
    expect(names.some((name) => name.endsWith('Query'))).toBe(true);
    expect(names.some((name) => name.endsWith('Param'))).toBe(true);
  });
});

describe('rule 1 — no input schema lets a client assert an identity or a status', () => {
  /**
   * The rule needs stating precisely, because two things that *look* like
   * violations are not.
   *
   * **A filter is not an identity.** `AuditQuery.dealerId` lets an admin
   * narrow the audit log to one dealership. An admin has no tenant of their
   * own, so naming one is the whole point — and the admin routers sit behind
   * `requireAdmin`, not `requireDealer`. The rule is that a *dealer-facing*
   * schema never names a dealership: that identity comes from the session, and
   * accepting it would make tenant isolation depend on every handler
   * remembering to ignore the field.
   *
   * **A lead status is not a listing status.** `UpdateEnquiryInput.status`
   * moves a lead NEW → CONTACTED → CLOSED, which is the dealer's own workflow
   * and has no moderation in it. What no client may set is a *listing* status:
   * that belongs to `transition()` (CLAUDE.md rule 5), and a schema accepting
   * it would be a way to publish without review.
   */
  const dealerFacing = inputSchemas.filter(([name]) => !(name in admin));

  it('finds dealer-facing input schemas to check', () => {
    expect(dealerFacing.length).toBeGreaterThan(10);
  });

  it.each(dealerFacing)('%s declares no dealerId', (_name, schema) => {
    expect(Object.keys(schema.shape)).not.toContain('dealerId');
  });

  it('lets an admin filter by dealership, which is a filter and not a claim', () => {
    expect(Object.keys(admin.AuditQuery.shape)).toContain('dealerId');
  });

  /** The state machine owns these, so no input may carry one. */
  it.each(inputSchemas)('%s declares no listingStatus or vehicleStatus', (_name, schema) => {
    const keys = Object.keys(schema.shape);
    expect(keys).not.toContain('listingStatus');
    expect(keys).not.toContain('vehicleStatus');
    expect(keys).not.toContain('displayStatus');
  });

  it('lets a status appear only as a filter, or as a lead’s own workflow state', () => {
    const withStatus = inputSchemas.filter(([, schema]) => 'status' in schema.shape);

    for (const [name] of withStatus) {
      expect(name === 'UpdateEnquiryInput' || name.endsWith('Query'), name).toBe(true);
    }
  });

  it('moves a lead only through the states a dealer owns', () => {
    expect(dealer.UpdateEnquiryInput.safeParse({ status: 'CONTACTED' }).success).toBe(true);
    expect(dealer.UpdateEnquiryInput.safeParse({ status: 'APPROVED' }).success).toBe(false);
  });

  /**
   * A slug is a public URL the server derives, so no *body* may carry one.
   * `SlugParam` is not a counter-example: it reads the slug out of the path
   * the caller is already at, rather than one they are asserting.
   */
  it.each(inputSchemas.filter(([name]) => name.endsWith('Input')))(
    '%s declares no slug',
    (_name, schema) => {
      expect(Object.keys(schema.shape)).not.toContain('slug');
    },
  );

  it('reads a slug only from a path parameter', () => {
    expect(Object.keys(common.SlugParam.shape)).toEqual(['slug']);
    expect(publicApi.DealerDirectoryQuery.safeParse({ slug: 'x' }).success).toBe(false);
  });

  it('lets no input schema carry a credit balance or a price the server computes', () => {
    for (const [name, schema] of inputSchemas) {
      const keys = Object.keys(schema.shape);
      expect(keys, name).not.toContain('creditBalance');
      expect(keys, name).not.toContain('amountPaise');
      expect(keys, name).not.toContain('totalPaise');
    }
  });

  /** §26.4: the order body is a packId and nothing else — the server prices it. */
  it('takes only a packId when a dealer buys credits', () => {
    expect(Object.keys(dealer.CreateOrderInput.shape)).toEqual(['packId']);
  });
});

describe('shared shapes', () => {
  it('defines one problem-details schema for every error', () => {
    expect(contracts.ProblemDetails.safeParse({
      type: 'https://dealersdrive.com/errors/not-found',
      title: 'Not found',
      status: 404,
      code: 'NOT_FOUND',
      traceId: 'a1b2c3d4e5',
    }).success).toBe(true);
  });

  it('requires the five fields every problem document carries', () => {
    expect(contracts.ProblemDetails.safeParse({ status: 404 }).success).toBe(false);
  });

  it('defines one cursor page shape, so no endpoint invents its own', () => {
    expect(Object.keys(contracts.CursorPage.shape).sort()).toEqual(
      ['nextCursor', 'hasMore'].sort(),
    );
  });

  it('defines one offset page shape', () => {
    expect(Object.keys(contracts.OffsetPage.shape)).toContain('total');
  });
});
