import { describe, expect, it } from 'vitest';

import {
  decodeCursor,
  decodeSeqCursor,
  encodeCursor,
  encodeSeqCursor,
} from '../../../src/platform/pagination.js';
import { ConflictError } from '../../../src/platform/errors.js';

/**
 * Unit tests for `src/platform/pagination.ts`.
 *
 * A cursor is not a secret — anyone can base64-decode it and there is nothing in
 * there worth hiding. What matters is that a client cannot *construct* one that
 * means something else, so the decoders get the attention here.
 */
describe('encodeCursor / decodeCursor', () => {
  it('round-trips a date to the millisecond', () => {
    const date = new Date('2026-08-17T15:44:29.365Z');

    expect(decodeCursor(encodeCursor(date)).toISOString()).toBe(date.toISOString());
  });

  it('encodes to base64url, so a cursor is URL-safe and opaque-looking', () => {
    const cursor = encodeCursor(new Date('2026-08-17T15:44:29.365Z'));

    // No `+`, `/` or `=` — those would need escaping in a query string.
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(cursor).not.toContain('2026');
  });

  it('rejects a cursor that decodes to something that is not a date', () => {
    const forged = Buffer.from('page 2 please').toString('base64url');

    expect(() => decodeCursor(forged)).toThrow(ConflictError);
    expect(() => decodeCursor(forged)).toThrow(/not valid/i);
  });

  it('rejects a cursor that is not base64 at all', () => {
    // Buffer.from is lenient, so this arrives as garbage bytes rather than
    // throwing — which is precisely why the date check exists.
    expect(() => decodeCursor('!!!!')).toThrow(ConflictError);
  });

  it('reports MALFORMED_CURSOR rather than a 500', () => {
    try {
      decodeCursor(Buffer.from('nope').toString('base64url'));
      expect.unreachable('a malformed cursor must throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).code).toBe('MALFORMED_CURSOR');
      expect((error as ConflictError).status).toBe(409);
    }
  });
});

describe('encodeSeqCursor / decodeSeqCursor', () => {
  it('round-trips the ledger sequence as a decimal string', () => {
    // A string, not a number: `seq` is BIGSERIAL and can outgrow Number.
    expect(decodeSeqCursor(encodeSeqCursor(42n))).toBe('42');
    expect(decodeSeqCursor(encodeSeqCursor(9_007_199_254_740_993n))).toBe('9007199254740993');
  });

  it('accepts zero', () => {
    expect(decodeSeqCursor(encodeSeqCursor(0n))).toBe('0');
  });

  it('rejects anything that is not all digits', () => {
    const cases = ['12; DROP TABLE credit_ledger', '-1', '1.5', '', 'abc', ' 12'];

    for (const value of cases) {
      const cursor = Buffer.from(value).toString('base64url');
      expect(() => decodeSeqCursor(cursor), `"${value}" should be rejected`).toThrow(ConflictError);
    }
  });

  it('rejects a SQL fragment even though it starts with digits', () => {
    // The decoded value reaches a raw query, so a partial match is not enough:
    // the pattern is anchored at both ends.
    const cursor = Buffer.from('1 OR 1=1').toString('base64url');

    expect(() => decodeSeqCursor(cursor)).toThrow(/not valid/i);
  });
});
