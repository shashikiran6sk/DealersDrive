import type { Request } from 'express';

import { signedInPrincipal } from '../../../middleware/auth.js';

export function byUser(req: Request): string {
  return signedInPrincipal(req).userId;
}
