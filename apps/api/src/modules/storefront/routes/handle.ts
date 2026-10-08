import type { Request, Response } from 'express';

import type { RouteHandler } from '../../../http/route.js';

export function handle(work: (req: Request, res: Response) => Promise<void>): RouteHandler {
  return (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    void work(req, res).catch(next);
  };
}
