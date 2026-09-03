import type { RequestHandler } from 'express';

import { NotFoundError } from '../platform/errors.js';

/**
 * Mounted after every router and before the error handler, so an unmatched
 * route produces a Problem Details body instead of Express's HTML page.
 */
export const notFound: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`No route matches ${req.method} ${req.originalUrl}.`));
};
