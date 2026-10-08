import { createHmac, timingSafeEqual } from 'node:crypto';

import { StorefrontHostname } from '@dealers-drive/contracts';
import type { Request } from 'express';
import { z } from 'zod';

import type { Env } from '../../config/env.js';
import type { Tx } from '../../platform/db/prisma.js';
import { ConfigurationError, NotFoundError, UnauthorizedError } from '../../platform/errors.js';
import { liveDomainWhere, liveStorefrontWhere } from './storefront.visibility.js';

export type StorefrontEnvironment = Pick<
  Env,
  | 'STOREFRONT_ENABLED'
  | 'STOREFRONT_SERVICE_SECRET'
  | 'STOREFRONT_ROOT_HOSTNAME'
  | 'STOREFRONT_DEFAULT_DOMAIN_READY'
  | 'WEB_BASE_URL'
>;

export function assertStorefrontEnabled(config: StorefrontEnvironment): void {
  if (!config.STOREFRONT_ENABLED)
    throw new ConfigurationError('Dealer websites are not enabled.', {
      code: 'STOREFRONT_DISABLED',
    });
}

export function trustedStorefrontHostname(req: Request, config: StorefrontEnvironment): string {
  assertStorefrontEnabled(config);
  const expected = config.STOREFRONT_SERVICE_SECRET;
  const supplied = req.get('x-dd-storefront-secret') ?? '';
  if (!expected || !safeEqual(supplied, expected)) throw new UnauthorizedError();
  return StorefrontHostname.parse(req.get('x-dd-storefront-host'));
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

const IntentPayload = z
  .object({
    hostname: StorefrontHostname,
    listingSlug: z.string().min(1).max(200),
    expiresAt: z.number().int(),
  })
  .strict();
export type StorefrontOrigin = { hostname: string; storefrontId: string; dealerId: string };

export function signStorefrontIntent(
  hostname: string,
  listingSlug: string,
  config: StorefrontEnvironment,
): string {
  const secret = config.STOREFRONT_SERVICE_SECRET;
  if (!secret) throw new ConfigurationError('Website enquiries are not configured.');
  const body = Buffer.from(
    JSON.stringify({ hostname, listingSlug, expiresAt: Date.now() + 30 * 60_000 }),
  ).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(`storefront-enquiry-v1:${body}`).digest('base64url')}`;
}

export function readStorefrontIntent(
  ticket: string,
  config: StorefrontEnvironment,
): z.infer<typeof IntentPayload> {
  assertStorefrontEnabled(config);
  const [body, signature, extra] = ticket.split('.');
  const secret = config.STOREFRONT_SERVICE_SECRET;
  if (
    !body ||
    !signature ||
    extra !== undefined ||
    !secret ||
    ticket.length > 1500 ||
    !safeEqual(
      signature,
      createHmac('sha256', secret).update(`storefront-enquiry-v1:${body}`).digest('base64url'),
    )
  ) {
    throw new UnauthorizedError('This enquiry link is invalid or expired.');
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new UnauthorizedError('This enquiry link is invalid or expired.');
  }
  const parsed = IntentPayload.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.expiresAt <= Date.now() ||
    parsed.data.expiresAt > Date.now() + 30 * 60_000
  ) {
    throw new UnauthorizedError('This enquiry link is invalid or expired.');
  }
  return parsed.data;
}

export async function lockStorefrontOrigin(tx: Tx, origin: StorefrontOrigin): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "dealers" WHERE "id" = ${origin.dealerId}::uuid FOR SHARE`;
  await tx.$queryRaw`SELECT "id" FROM "dealer_storefronts" WHERE "id" = ${origin.storefrontId}::uuid FOR SHARE`;
  await tx.$queryRaw`SELECT "id" FROM "storefront_domains" WHERE "hostname" = ${origin.hostname} FOR SHARE`;
  const count = await tx.storefrontDomain.count({
    where: {
      hostname: origin.hostname,
      ...liveDomainWhere(true),
      storefront: {
        id: origin.storefrontId,
        dealerId: origin.dealerId,
        ...liveStorefrontWhere(true),
      },
    },
  });
  if (count !== 1) throw new NotFoundError('This website is unavailable.');
}
