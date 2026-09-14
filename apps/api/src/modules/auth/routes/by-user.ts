import type { Request } from 'express';

import { signedInPrincipal } from '../../../middleware/auth.js';

/** Counted per person, not per address: a dealership is often one office NAT. */
export function byUser(req: Request): string {
  return signedInPrincipal(req).userId;
}
