import { randomBytes } from 'node:crypto';

import { StorefrontHostname, type StorefrontManagementResponse } from '@dealers-drive/contracts';
import type { PrismaClient, StorefrontDomain } from '@prisma/client';

import type { AuditService } from '../../platform/audit/audit.service.js';
import type { Tx } from '../../platform/db/prisma.js';
import { ConflictError, DomainError, NotFoundError, errorCode } from '../../platform/errors.js';
import { logger } from '../../platform/telemetry/logger.js';
import type { DealerWriteActor } from '../auth/auth.facade.js';
import type { DomainProvider } from './domain-provider.port.js';
import { isDomainLive } from './storefront.mapper.js';
import type { StorefrontService } from './storefront.service.js';

export function createStorefrontDomains(
  prisma: PrismaClient,
  audit: AuditService,
  service: StorefrontService,
  provider: DomainProvider,
) {
  async function domainOf(tx: Tx, dealerId: string, id: string): Promise<StorefrontDomain> {
    const domain = await tx.storefrontDomain.findFirst({ where: { id, storefront: { dealerId } } });
    if (!domain) throw new NotFoundError('This domain is unavailable.');
    return domain;
  }
  async function fallback(tx: Tx, domain: StorefrontDomain): Promise<void> {
    if (!domain.isPrimary) return;
    await tx.storefrontDomain.update({ where: { id: domain.id }, data: { isPrimary: false } });
    const others = await tx.storefrontDomain.findMany({
      where: { storefrontId: domain.storefrontId, id: { not: domain.id } },
      orderBy: { createdAt: 'asc' },
    });
    const candidate = others.find(
      (row) =>
        isDomainLive(row) &&
        (row.kind === 'CUSTOM' || service.config.STOREFRONT_DEFAULT_DOMAIN_READY),
    );
    if (candidate)
      await tx.storefrontDomain.update({ where: { id: candidate.id }, data: { isPrimary: true } });
    else
      await tx.dealerStorefront.updateMany({
        where: { id: domain.storefrontId, status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] } },
        data: { status: 'SUSPENDED' },
      });
  }
  async function auditChange(
    tx: Tx,
    actor: DealerWriteActor,
    action: string,
    domain: StorefrontDomain,
  ): Promise<void> {
    await audit.record(tx, {
      actorType: 'DEALER',
      actorId: actor.userId,
      dealerId: actor.dealerId,
      action,
      entityType: 'StorefrontDomain',
      entityId: domain.id,
      after: { hostname: domain.hostname },
    });
  }
  async function check(tx: Tx, domain: StorefrontDomain): Promise<void> {
    if (domain.kind !== 'CUSTOM' || ['REMOVED', 'REMOVAL_PENDING'].includes(domain.status))
      throw new DomainError(
        'DOMAIN_NOT_VERIFIABLE',
        'Only a pending or active custom domain can be verified.',
      );
    if (
      !domain.ownershipToken ||
      !(await provider.ownership(domain.hostname, domain.ownershipToken))
    ) {
      await fallback(tx, domain);
      await tx.storefrontDomain.update({
        where: { id: domain.id },
        data: {
          status: 'VERIFICATION_REQUIRED',
          isPrimary: false,
          ownershipVerifiedAt: null,
          verifiedAt: null,
          certificateReady: false,
          checkedAt: new Date(),
          lastError: 'Add the dealership ownership TXT record, then check again.',
        },
      });
      return;
    }
    try {
      if (!domain.providerAttachedAt) {
        await provider.attach(domain.hostname);
        await tx.storefrontDomain.update({
          where: { id: domain.id },
          data: { providerAttachedAt: new Date() },
        });
      }
      const inspected = await provider.inspect(domain.hostname);
      const active = inspected.verified && inspected.configured && inspected.certificateReady;
      if (!active) await fallback(tx, domain);
      const verification = inspected.verification[0];
      await tx.storefrontDomain.update({
        where: { id: domain.id },
        data: {
          status: active ? 'ACTIVE' : 'VERIFICATION_REQUIRED',
          ...(active ? {} : { isPrimary: false }),
          ownershipVerifiedAt: new Date(),
          verifiedAt: active ? new Date() : null,
          certificateReady: active,
          checkedAt: new Date(),
          verificationName: verification?.name ?? null,
          verificationValue: verification?.value ?? null,
          routingType: inspected.routing?.type ?? null,
          routingName: inspected.routing?.name ?? null,
          routingValue: inspected.routing?.value ?? null,
          lastError: active
            ? null
            : 'Ownership is proved. Provider verification, routing or TLS is still pending.',
        },
      });
    } catch (error) {
      await fallback(tx, domain);
      await tx.storefrontDomain.update({
        where: { id: domain.id },
        data: {
          status: 'FAILED',
          isPrimary: false,
          certificateReady: false,
          verifiedAt: null,
          checkedAt: new Date(),
          lastError:
            errorCode(error) === 'DOMAIN_EXISTING_DEPLOYMENT' ||
            errorCode(error) === 'DOMAIN_PROVIDER_CONFLICT'
              ? 'The provider reports a conflicting deployment. Contact support; no transfer was attempted.'
              : 'The domain provider is unavailable or not configured. Retry after configuration or recovery.',
        },
      });
      logger.warn(
        { event: 'storefront.domain.check_failed', code: errorCode(error) ?? 'PROVIDER_FAILURE' },
        'domain verification failed',
      );
    }
  }
  async function removeProvider(tx: Tx, domain: StorefrontDomain): Promise<void> {
    try {
      if (domain.providerAttachedAt) await provider.remove(domain.hostname);
      await tx.storefrontDomain.update({
        where: { id: domain.id },
        data: {
          status: 'REMOVED',
          removedAt: new Date(),
          providerAttachedAt: null,
          ownershipToken: null,
          ownershipVerifiedAt: null,
          verifiedAt: null,
          certificateReady: false,
          isPrimary: false,
          lastError: null,
        },
      });
    } catch {
      await tx.storefrontDomain.update({
        where: { id: domain.id },
        data: {
          status: 'REMOVAL_PENDING',
          lastError: 'Website access is revoked. Provider removal is pending and will be retried.',
        },
      });
    }
  }
  return {
    providerConfigured: provider.configured,
    async add(actor: DealerWriteActor, raw: string): Promise<StorefrontManagementResponse> {
      const hostname = StorefrontHostname.parse(raw);
      if (
        hostname === service.config.STOREFRONT_ROOT_HOSTNAME ||
        hostname.endsWith(`.${service.config.STOREFRONT_ROOT_HOSTNAME}`) ||
        ['vercel.app', 'dealers-drive.com'].some(
          (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
        )
      )
        throw new DomainError(
          'DOMAIN_RESERVED',
          'Use a custom domain outside the platform and hosting-provider domain.',
        );
      try {
        await service.write(actor, async (tx) => {
          const site = await service.rowOf(tx, actor.dealerId);
          const existing = await tx.storefrontDomain.findUnique({ where: { hostname } });
          if (existing && existing.storefrontId !== site.id)
            throw new ConflictError(
              'DOMAIN_RESERVED',
              'This domain is reserved by another dealership and cannot be reassigned.',
            );
          if (existing && existing.status !== 'REMOVED') return;
          const count = await tx.storefrontDomain.count({
            where: { storefrontId: site.id, kind: 'CUSTOM', status: { not: 'REMOVED' } },
          });
          if (count >= 3)
            throw new DomainError(
              'DOMAIN_LIMIT',
              'V1 supports up to three custom domains per dealership.',
            );
          const data = {
            status: 'VERIFICATION_REQUIRED' as const,
            ownershipToken: `dd-website-${randomBytes(24).toString('hex')}`,
            ownershipVerifiedAt: null,
            verifiedAt: null,
            certificateReady: false,
            checkedAt: null,
            removedAt: null,
            providerAttachedAt: null,
            isPrimary: false,
            lastError: null,
            verificationName: null,
            verificationValue: null,
            routingType: null,
            routingName: null,
            routingValue: null,
          };
          const domain = existing
            ? await tx.storefrontDomain.update({ where: { id: existing.id }, data })
            : await tx.storefrontDomain.create({
                data: { ...data, storefrontId: site.id, kind: 'CUSTOM', hostname },
              });
          await auditChange(tx, actor, 'storefront.domain_reserved', domain);
        });
      } catch (error) {
        if (errorCode(error) === 'STOREFRONT_NAME_TAKEN')
          throw new ConflictError('DOMAIN_RESERVED', 'This domain is already reserved.');
        throw error;
      }
      return service.management(actor);
    },
    async refresh(actor: DealerWriteActor, id: string) {
      await service.write(actor, async (tx) => {
        const domain = await domainOf(tx, actor.dealerId, id);
        await check(tx, domain);
        await auditChange(tx, actor, 'storefront.domain_checked', domain);
      });
      return service.management(actor);
    },
    async primary(actor: DealerWriteActor, id: string) {
      await service.write(actor, async (tx) => {
        const domain = await domainOf(tx, actor.dealerId, id);
        if (
          !isDomainLive(domain) ||
          (domain.kind === 'DEFAULT' && !service.config.STOREFRONT_DEFAULT_DOMAIN_READY)
        )
          throw new DomainError('DOMAIN_NOT_ACTIVE', 'Choose a verified, TLS-ready domain.');
        await tx.storefrontDomain.updateMany({
          where: { storefrontId: domain.storefrontId, isPrimary: true },
          data: { isPrimary: false },
        });
        await tx.storefrontDomain.update({ where: { id }, data: { isPrimary: true } });
        await auditChange(tx, actor, 'storefront.primary_changed', domain);
      });
      return service.management(actor);
    },
    async remove(actor: DealerWriteActor, id: string) {
      await service.write(actor, async (tx) => {
        const domain = await domainOf(tx, actor.dealerId, id);
        if (domain.kind === 'DEFAULT')
          throw new DomainError(
            'DEFAULT_DOMAIN_REQUIRED',
            'The default domain reservation is retained. Disable the website instead.',
          );
        if (domain.status === 'REMOVED') return;
        await fallback(tx, domain);
        await tx.storefrontDomain.update({
          where: { id },
          data: {
            status: 'REMOVAL_PENDING',
            isPrimary: false,
            verifiedAt: null,
            certificateReady: false,
          },
        });
        await removeProvider(tx, domain);
        await auditChange(tx, actor, 'storefront.domain_removed', domain);
      });
      return service.management(actor);
    },
    async sweep(): Promise<void> {
      if (!service.config.STOREFRONT_ENABLED || !provider.configured) return;
      const due = await prisma.storefrontDomain.findMany({
        where: {
          kind: 'CUSTOM',
          OR: [
            { status: 'REMOVAL_PENDING' },
            { status: 'ACTIVE', checkedAt: { lt: new Date(Date.now() - 12 * 60 * 60_000) } },
          ],
        },
        include: { storefront: { select: { dealerId: true } } },
        orderBy: [{ checkedAt: 'asc' }, { id: 'asc' }],
        take: 100,
      });
      for (const row of due) {
        try {
          await prisma.$transaction(
            async (tx) => {
              await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storefront:${row.storefront.dealerId}`}))`;
              await tx.$queryRaw`SELECT "id" FROM "storefront_domains" WHERE "id"=${row.id}::uuid FOR UPDATE`;
              const current = await tx.storefrontDomain.findUnique({ where: { id: row.id } });
              if (!current) return;
              if (current.status === 'REMOVAL_PENDING') await removeProvider(tx, current);
              else if (current.status === 'ACTIVE') await check(tx, current);
            },
            { timeout: 20000 },
          );
        } catch {
          logger.warn(
            { event: 'storefront.domain.sweep_failed' },
            'domain verification sweep failed',
          );
        }
      }
    },
  };
}
export type StorefrontDomainsService = ReturnType<typeof createStorefrontDomains>;
