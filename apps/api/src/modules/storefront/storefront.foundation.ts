import {
  canTransitionStorefront,
  type CreateStorefrontInput,
  type StorefrontStatus,
} from '@dealers-drive/contracts';
import type { DealerStorefront } from '@prisma/client';

import type { Tx } from '../../platform/db/prisma.js';
import { ConflictError, NotFoundError } from '../../platform/errors.js';

export async function reserveStorefront(
  tx: Tx,
  dealerId: string,
  input: CreateStorefrontInput,
  rootHostname: string,
): Promise<DealerStorefront> {
  const dealer = await tx.$queryRaw<{ brandName: string }[]>`
    SELECT "brandName" FROM "dealers" WHERE "id" = ${dealerId}::uuid FOR UPDATE`;
  if (!dealer[0]) throw new NotFoundError();
  const existing = await tx.dealerStorefront.findUnique({ where: { dealerId } });
  if (existing) {
    if (existing.subdomain !== input.subdomain) {
      throw new ConflictError(
        'STOREFRONT_ALREADY_CREATED',
        'This dealership already has a reserved website name.',
      );
    }
    return existing;
  }
  return tx.dealerStorefront.create({
    data: {
      dealerId,
      subdomain: input.subdomain,
      displayName: dealer[0].brandName.slice(0, 100),
      theme: input.theme,
      domains: { create: { hostname: `${input.subdomain}.${rootHostname}`, kind: 'DEFAULT' } },
    },
  });
}

export async function transitionStorefront(
  tx: Tx,
  dealerId: string,
  next: StorefrontStatus,
): Promise<DealerStorefront> {
  const locked = await tx.$queryRaw<{ id: string; status: StorefrontStatus }[]>`
    SELECT "id", "status" FROM "dealer_storefronts"
    WHERE "dealerId" = ${dealerId}::uuid FOR UPDATE`;
  const current = locked[0];
  if (!current) throw new NotFoundError('Create your website first.');
  if (!canTransitionStorefront(current.status, next)) {
    throw new ConflictError(
      'INVALID_STOREFRONT_TRANSITION',
      'The website cannot make that state change.',
    );
  }
  if (next === 'ACTIVE') {
    const eligible = await tx.dealer.count({ where: { id: dealerId, status: 'ACTIVE' } });
    const verified = await tx.storefrontDomain.count({
      where: {
        storefrontId: current.id,
        status: 'ACTIVE',
        isPrimary: true,
        certificateReady: true,
        verifiedAt: { not: null },
      },
    });
    if (eligible !== 1 || verified !== 1) {
      throw new ConflictError(
        'STOREFRONT_NOT_READY',
        'An approved dealership and a verified primary domain are required.',
      );
    }
  }
  return tx.dealerStorefront.update({ where: { id: current.id }, data: { status: next } });
}

export async function suspendDealerStorefront(tx: Tx, dealerId: string): Promise<void> {
  await tx.dealerStorefront.updateMany({
    where: { dealerId, status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] } },
    data: { status: 'SUSPENDED' },
  });
}
