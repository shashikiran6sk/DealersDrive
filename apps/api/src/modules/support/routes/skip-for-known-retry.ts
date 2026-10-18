import { Uuid } from '@dealers-drive/contracts';
import type { RequestHandler } from 'express';

import { customerPrincipal } from '../../../middleware/auth.js';
import { isRecord } from '../../../platform/errors.js';
import type { SupportService } from '../support.service.js';

export function skipForKnownRetry(
  service: SupportService,
  limiter: RequestHandler,
): RequestHandler {
  return (req, res, next) => {
    const body: unknown = req.body;
    const id = Uuid.safeParse(isRecord(body) ? body.clientRequestId : undefined);
    if (!id.success) {
      limiter(req, res, next);
      return;
    }
    service
      .hasRetry(customerPrincipal(req), id.data)
      .then((known) => (known ? next() : limiter(req, res, next)))
      .catch(next);
  };
}
