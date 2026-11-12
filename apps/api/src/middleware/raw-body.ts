import type { IncomingMessage } from 'node:http';

const RAW_BODY_PREFIX = '/v1/webhooks/';

const rawBodies = new WeakMap<IncomingMessage, Buffer>();

export function captureRawBody(req: IncomingMessage, _res: unknown, buffer: Buffer): void {
  if (req.url?.startsWith(RAW_BODY_PREFIX)) rawBodies.set(req, Buffer.from(buffer));
}

export function rawBodyOf(req: IncomingMessage): Buffer | null {
  return rawBodies.get(req) ?? null;
}
