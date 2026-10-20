import type { Request } from 'express';

const CUSTOMER_BEARER_ROUTES = [
  /^\/v1\/auth\/customer\/me\/?$/,
  /^\/v1\/auth\/customer\/account(?:\/deactivate)?\/?$/,
  /^\/v1\/auth\/native\/customer\/(?:me|logout)\/?$/,
  /^\/v1\/legal\/customer\/(?:status|history|terms)\/?$/,
  /^\/v1\/enquiries(?:\/|$)/,
  /^\/v1\/saved-vehicles(?:\/|$)/,
  /^\/v1\/support(?:\/|$)/,
];

export function readCustomerBearer(req: Request): string | undefined {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(req.get('authorization') ?? '');
  return match?.[1];
}

export function allowsCustomerBearer(req: Request): boolean {
  const path = req.originalUrl.split('?')[0] ?? '';
  return customerBearerPath(path);
}

export function customerBearerPath(path: string): boolean {
  return CUSTOMER_BEARER_ROUTES.some((pattern) => pattern.test(path));
}
