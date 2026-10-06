import type { Request } from 'express';

import type { RouteHandler } from '../../../http/route.js';

export function handle<T>(work: (req: Request) => Promise<T>, status = 200): RouteHandler {
  return (req, res, next) => {
    void (async () => {
      try {
        res.set('Cache-Control', 'no-store');
        res.status(status).json(await work(req));
      } catch (error) {
        next(error);
      }
    })();
  };
}
