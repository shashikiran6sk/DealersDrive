import type { Request } from 'express';

import { isRecord } from '../errors.js';

export function normalizedHttpRoute(req: Request): string {
  const routePath = routePattern(req);
  if (routePath === undefined) return 'unmatched';

  const originalSegments = pathname(req.originalUrl).split('/').filter(Boolean);
  const routeSegments = routePath.split('/').filter(Boolean);
  if (routeSegments.length > originalSegments.length) return 'unmatched';

  const prefix = originalSegments.slice(0, originalSegments.length - routeSegments.length);
  const full = [...prefix, ...routeSegments];
  return full.length === 0 ? '/' : `/${full.join('/')}`;
}

function routePattern(req: Request): string | undefined {
  const value = isRecord(req.route) ? req.route.path : undefined;
  return typeof value === 'string' ? value : undefined;
}

function pathname(originalUrl: string): string {
  const question = originalUrl.indexOf('?');
  const value = question === -1 ? originalUrl : originalUrl.slice(0, question);
  return value || '/';
}
