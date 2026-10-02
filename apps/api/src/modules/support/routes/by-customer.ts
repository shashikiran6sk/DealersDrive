import type { Request } from 'express';

import { customerPrincipal } from '../../../middleware/auth.js';

export function byCustomer(req: Request): string {
  return customerPrincipal(req).userId;
}
