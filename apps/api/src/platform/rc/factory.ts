import { env } from '../../config/env.js';
import { createAttestrRcLookup } from './attestr.adapter.js';
import { createMockRcLookup } from './mock.adapter.js';
import type { RcLookupPort } from './rc.port.js';

/**
 * The RC provider, chosen by one variable — the same shape as
 * `storage/factory.ts` and the `SMS_DRIVER` branch in the container.
 *
 *   mock    — deterministic, free, offline. The default outside production,
 *             and what the test suite uses. Not a deferred feature: intake
 *             works end to end on it, including every failure branch.
 *   attestr — the real provider. `env.ts` refuses to boot without the auth
 *             token when this is selected, so a misconfigured deploy fails at
 *             start rather than at the first dealer who adds a car.
 */
export function createRcLookup(): RcLookupPort {
  return env.RC_LOOKUP_DRIVER === 'attestr' ? createAttestrRcLookup() : createMockRcLookup();
}
