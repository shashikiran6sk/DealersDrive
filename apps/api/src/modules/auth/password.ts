import { hash, verify } from '@node-rs/argon2';

/**
 * Admin passwords. Dealers never reach this file — they sign in with Google,
 * and a `passwordHash` on a non-admin row is refused by a database constraint
 * (`only_admins_have_passwords`, ARCHITECTURE §8.1).
 *
 * Argon2id at the OWASP-recommended floor: 19 MiB of memory, two passes. The
 * memory cost is the point — it is what makes a stolen hash expensive to attack
 * on a GPU, and it is why a plain SHA-256 of a password is not a password hash.
 */
/**
 * `Algorithm.Argon2id` from the binding, spelled as its numeric value: the
 * enum is an ambient `const enum`, which `verbatimModuleSyntax` cannot import.
 */
const ARGON2ID = 2;

const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * A hash of a value nobody knows, verified against when the email does not
 * exist. Comparing against *something* keeps the response time of "no such
 * admin" and "wrong password" in the same range, so the login endpoint does not
 * become an account-enumeration oracle.
 */
let decoyHash: Promise<string> | null = null;

export function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, ARGON2_OPTIONS);
}

/** False for any malformed or foreign hash, rather than throwing. */
export async function verifyPassword(storedHash: string, plaintext: string): Promise<boolean> {
  try {
    return await verify(storedHash, plaintext, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

/** Burns the same work a real verification would. Always resolves false. */
export async function verifyDecoy(plaintext: string): Promise<false> {
  decoyHash ??= hash(`decoy:${Math.random()}`, ARGON2_OPTIONS);
  await verifyPassword(await decoyHash, plaintext);
  return false;
}
