import type { Request, Response, NextFunction } from 'express';
import type { RouteRegistrar } from '../../../../http/route.js';
import type { NativeAuthService } from '../../native-auth.service.js';
import type { SessionService } from '../../session.service.js';
import type { CustomerAuthService } from '../../customer-auth.service.js';

export interface NativeAuthRouteDeps {
  service: NativeAuthService;
  sessions: SessionService;
  customers: CustomerAuthService;
}
export type NativeAuthRoute = RouteRegistrar<NativeAuthRouteDeps>;
export function nativeHandle(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', 'no-store');
    void handler(req, res).catch(next);
  };
}
