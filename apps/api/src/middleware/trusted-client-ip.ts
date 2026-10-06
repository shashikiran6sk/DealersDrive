import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

import type { RequestHandler } from 'express';

export const CLIENT_IP_HEADER = 'x-dd-client-ip';
export const CLIENT_IP_SECRET_HEADER = 'x-dd-forward-secret';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function createTrustedClientIp(secret: string | undefined): RequestHandler {
  const expected = secret ? digest(secret) : undefined;

  return (req, _res, next) => {
    const presented = single(req.headers[CLIENT_IP_SECRET_HEADER]);
    const claimed = single(req.headers[CLIENT_IP_HEADER])?.trim();
    delete req.headers[CLIENT_IP_SECRET_HEADER];
    delete req.headers[CLIENT_IP_HEADER];

    if (
      expected &&
      presented &&
      claimed &&
      isIP(claimed) !== 0 &&
      timingSafeEqual(digest(presented), expected)
    ) {
      Object.defineProperty(req, 'ip', { value: claimed, configurable: true, enumerable: true });
    }
    next();
  };
}
