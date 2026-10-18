import { legalReleaseReady } from '@dealers-drive/contracts';
import type { RequestHandler } from 'express';

import { env } from '../../config/env.js';
import { DomainError } from '../../platform/errors.js';

export function legalRightsReleased(): boolean {
  return legalReleaseReady() || env.APP_ENV !== 'production';
}

export const requireLegalRelease: RequestHandler = (_req, _res, next) => {
  if (legalRightsReleased()) {
    next();
    return;
  }
  next(
    new DomainError(
      'LEGAL_NOT_ACTIVE',
      'Privacy controls are not available yet. Contact customer support to change how your details are shared.',
    ),
  );
};
