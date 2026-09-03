import { describe, expect, it } from 'vitest';

import {
  hashPassword,
  verifyDecoy,
  verifyPassword,
} from '../../../../src/modules/auth/password.js';

/**
 * Admin passwords. Dealers never reach this file — they sign in with Google,
 * and a `passwordHash` on a non-admin row is refused by a database constraint.
 *
 * Argon2id, at the OWASP floor. The properties that matter are that the hash is
 * salted (so two admins with the same password do not share a digest), that a
 * wrong password is false rather than an exception, and that a malformed stored
 * hash cannot become an accidental "yes".
 */
describe('hashing', () => {
  it('produces an Argon2id hash, not a bare digest', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('salts, so the same password twice is two different hashes', async () => {
    const [first, second] = await Promise.all([hashPassword('same'), hashPassword('same')]);

    expect(first).not.toBe(second);
  });

  it('never contains the plaintext', async () => {
    expect(await hashPassword('hunter2')).not.toContain('hunter2');
  });
});

describe('verifying', () => {
  it('accepts the right password', async () => {
    const hash = await hashPassword('right');

    expect(await verifyPassword(hash, 'right')).toBe(true);
  });

  it.each([['wrong'], [''], ['RIGHT'], ['right ']])('rejects %j', async (candidate) => {
    const hash = await hashPassword('right');

    expect(await verifyPassword(hash, candidate)).toBe(false);
  });

  /**
   * A hash from another algorithm, a truncated column, an empty string: all
   * are "no", never a throw that a caller might mistake for an outage — and
   * never a "yes".
   */
  it.each([['not-a-hash'], [''], ['$2b$10$abcdefghijklmnopqrstuv']])(
    'refuses a malformed stored hash %j without throwing',
    async (stored) => {
      expect(await verifyPassword(stored, 'anything')).toBe(false);
    },
  );
});

describe('the decoy', () => {
  /**
   * Burnt when the email does not exist, so "no such admin" and "wrong
   * password" take comparable time. Without it, sign-in becomes an
   * account-enumeration oracle measurable with a stopwatch.
   */
  it('always answers false', async () => {
    expect(await verifyDecoy('anything')).toBe(false);
    expect(await verifyDecoy('')).toBe(false);
  });

  it('does real work rather than returning immediately', async () => {
    const started = process.hrtime.bigint();
    await verifyDecoy('anything');
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;

    // Argon2id at 19MiB is milliseconds, not microseconds. A constant `false`
    // would be far under 1ms and would defeat the point.
    expect(elapsedMs).toBeGreaterThan(1);
  });
});
