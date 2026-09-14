import type { NextFunction, Request, Response, Router } from 'express';

export type RouteRegistrar<TDeps> = (router: Router, deps: TDeps) => void;

export type RouteHandler = (req: Request, res: Response, next: NextFunction) => void;
