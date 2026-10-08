import 'server-only';

import { headers } from 'next/headers';
import type { z } from 'zod';

import { requestHostname } from './hostname';

export class StorefrontApiError extends Error {
  constructor(readonly status: number) {
    super('This dealership website is unavailable.');
    this.name = 'StorefrontApiError';
  }
}

export async function storefrontRequest<T>(
  schema: z.ZodType<T>,
  path: string,
  body?: unknown,
): Promise<T> {
  const incoming = await headers();
  const hostname = requestHostname(
    incoming.get('host'),
    process.env.STOREFRONT_DEV_HOSTNAME,
    process.env.NODE_ENV === 'production',
  );
  const secret = process.env.STOREFRONT_SERVICE_SECRET;
  if (!secret) throw new StorefrontApiError(503);
  const requestId = crypto.randomUUID();
  const forwardedSecret = process.env.CLIENT_IP_FORWARD_SECRET;
  const forwardedIp =
    incoming.get('x-real-ip') ?? incoming.get('x-forwarded-for')?.split(',')[0]?.trim();
  let response: Response;
  const startedAt = performance.now();
  try {
    response = await fetch(
      `${process.env.API_BASE_URL ?? 'http://localhost:4000'}/v1/storefront${path}`,
      {
        method: body === undefined ? 'GET' : 'POST',
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
        headers: {
          Accept: 'application/json',
          'x-dd-storefront-host': hostname,
          'x-dd-storefront-secret': secret,
          'x-request-id': requestId,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(forwardedSecret && forwardedIp
            ? { 'x-dd-forward-secret': forwardedSecret, 'x-dd-client-ip': forwardedIp }
            : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
  } catch {
    throw new StorefrontApiError(503);
  }
  process.stdout.write(
    JSON.stringify({
      event: 'storefront.api',
      requestId,
      route: path.split('?')[0],
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
    }) + '\n',
  );
  if (!response.ok) throw new StorefrontApiError(response.status);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new StorefrontApiError(503);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new StorefrontApiError(503);
  return parsed.data;
}
