import { createHmac } from 'node:crypto';

import { env } from '../../config/env.js';

/**
 * The key `rc_lookups` is stored under.
 *
 * Keyed HMAC rather than a plain digest: registration numbers occupy a small,
 * fully enumerable space — roughly 10^7 per RTO series — so an unkeyed
 * SHA-256 of a plate is reversible by anyone who can write a loop. A secret
 * makes the table useless without it.
 *
 * This is not secrecy from ourselves; real listings hold the plate in
 * `vehicles.regNumberMasked`. It stops the *lookup cache* becoming a
 * standalone, queryable register of every plate anyone ever asked about —
 * including the ones that never became a listing, which is the set nobody
 * consented to being in.
 *
 * Rotating `RC_PLATE_HASH_SECRET` orphans one cache generation and costs one
 * round of provider calls. Nothing else depends on it.
 */
export function plateHash(registrationNumber: string): string {
  return createHmac('sha256', env.RC_PLATE_HASH_SECRET)
    .update(registrationNumber.toUpperCase())
    .digest('hex');
}
