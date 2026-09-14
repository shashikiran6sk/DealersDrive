import type { NextFunction, Request, Response, Router } from 'express';

/**
 * One route, in one file, registering itself on its module's router.
 *
 * `<module>.routes.ts` holds the list and the order; each entry in that list is
 * a file next to it under `routes/`. Order is the list's, because Express
 * matches in registration order.
 */
export type RouteRegistrar<TDeps> = (router: Router, deps: TDeps) => void;

export type RouteHandler = (req: Request, res: Response, next: NextFunction) => void;
