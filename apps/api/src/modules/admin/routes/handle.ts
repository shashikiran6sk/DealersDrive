import type { Request } from 'express';

import type { RouteHandler } from '../../../http/route.js';

/**
 * `Cache-Control: no-store` on everything this router answers: a moderator
 * acting on a stale queue approves a listing somebody else already rejected.
 */
export function handle<T>(work: (req: Request) => Promise<T>, status = 200): RouteHandler {
  return (req, res, next) => {
    void (async () => {
      try {
        res.set('Cache-Control', 'no-store');
        const body = await work(req);
        if (body === undefined) res.status(204).end();
        else res.status(status).json(body);
      } catch (error) {
        next(error);
      }
    })();
  };
}
