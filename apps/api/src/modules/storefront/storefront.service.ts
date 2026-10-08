import {
  type CreateStorefrontInput,
  type PublicStorefrontDto,
  type SetPublicationInput,
  type StorefrontBrandingInput,
  type StorefrontEnquiryContext,
  type StorefrontIntentResponse,
  type StorefrontInventoryQuery,
  type StorefrontManagementResponse,
  type StorefrontPreviewResponse,
} from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

import type { AuditService } from '../../platform/audit/audit.service.js';
import type { Tx } from '../../platform/db/prisma.js';
import { withTransaction } from '../../platform/db/tenant-tx.js';
import { ConflictError, DomainError, NotFoundError, errorCode } from '../../platform/errors.js';
import { authorizeDealerWrite, type DealerWriteActor } from '../auth/auth.facade.js';
import { reserveStorefront, transitionStorefront } from './storefront.foundation.js';
import {
  configDto,
  isDomainLive,
  storefrontInclude,
  type StorefrontRow,
} from './storefront.mapper.js';
import { createStorefrontPublic } from './storefront.public.js';
import {
  assertStorefrontEnabled,
  readStorefrontIntent,
  signStorefrontIntent,
  trustedStorefrontHostname,
  type StorefrontEnvironment,
} from './storefront.security.js';

export interface StorefrontDeps {
  prisma: PrismaClient;
  audit: AuditService;
  config: StorefrontEnvironment;
}

export function createStorefrontService({ prisma, audit, config }: StorefrontDeps) {
  const publicRead = createStorefrontPublic(prisma, config);

  function managementOf(
    row: StorefrontRow | null,
    eligible: boolean,
  ): StorefrontManagementResponse {
    const primary = row?.domains.find((domain) => domain.isPrimary && isDomainLive(domain));
    const ready = Boolean(
      primary && (primary.kind === 'CUSTOM' || config.STOREFRONT_DEFAULT_DOMAIN_READY),
    );
    const storefront = row ? configDto(row) : null;
    if (storefront && (!config.STOREFRONT_ENABLED || !ready)) storefront.publicUrl = null;
    return {
      enabled: config.STOREFRONT_ENABLED,
      eligible,
      infrastructureReady: ready || config.STOREFRONT_DEFAULT_DOMAIN_READY,
      storefront,
    };
  }

  async function rowOf(tx: Tx, dealerId: string): Promise<StorefrontRow> {
    const row = await tx.dealerStorefront.findUnique({
      where: { dealerId },
      include: storefrontInclude,
    });
    if (!row) throw new NotFoundError('Create your website first.');
    return row;
  }

  async function write<T>(actor: DealerWriteActor, work: (tx: Tx) => Promise<T>): Promise<T> {
    assertStorefrontEnabled(config);
    try {
      return await withTransaction(prisma, async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storefront:${actor.dealerId}`}))`;
        await authorizeDealerWrite(tx, actor, 'storefront:manage', true);
        return work(tx);
      });
    } catch (error) {
      if (errorCode(error) === 'P2002')
        throw new ConflictError(
          'STOREFRONT_NAME_TAKEN',
          'That website name or domain is already reserved.',
        );
      throw error;
    }
  }

  async function read<T>(actor: DealerWriteActor, work: (tx: Tx) => Promise<T>): Promise<T> {
    return withTransaction(prisma, async (tx) => {
      await authorizeDealerWrite(tx, actor, 'storefront:read');
      return work(tx);
    });
  }

  async function record(
    tx: Tx,
    actor: DealerWriteActor,
    action: string,
    id: string,
    after: unknown,
  ): Promise<void> {
    await audit.record(tx, {
      actorType: 'DEALER',
      actorId: actor.userId,
      dealerId: actor.dealerId,
      action,
      entityType: 'DealerStorefront',
      entityId: id,
      after,
    });
  }

  return {
    publicRead,
    config,
    hostname: (req: Parameters<typeof trustedStorefrontHostname>[0]) =>
      trustedStorefrontHostname(req, config),
    write,
    read,
    rowOf,

    async management(actor: DealerWriteActor): Promise<StorefrontManagementResponse> {
      return withTransaction(prisma, async (tx) => {
        await authorizeDealerWrite(tx, actor, 'storefront:read');
        const [row, eligible] = await Promise.all([
          tx.dealerStorefront.findUnique({
            where: { dealerId: actor.dealerId },
            include: storefrontInclude,
          }),
          tx.dealer.count({ where: { id: actor.dealerId, status: 'ACTIVE' } }),
        ]);
        return managementOf(row, eligible === 1);
      });
    },

    async create(
      actor: DealerWriteActor,
      input: CreateStorefrontInput,
    ): Promise<StorefrontManagementResponse> {
      return write(actor, async (tx) => {
        const row = await reserveStorefront(
          tx,
          actor.dealerId,
          input,
          config.STOREFRONT_ROOT_HOSTNAME,
        );
        await record(tx, actor, 'storefront.reserved', row.id, { subdomain: row.subdomain });
        return managementOf(await rowOf(tx, actor.dealerId), true);
      });
    },

    async branding(
      actor: DealerWriteActor,
      input: StorefrontBrandingInput,
    ): Promise<StorefrontManagementResponse> {
      return write(actor, async (tx) => {
        const row = await rowOf(tx, actor.dealerId);
        const references = [
          input.logoMediaId,
          input.heroMediaId,
          ...(input.yardMediaIds ?? []),
        ].filter((id): id is string => typeof id === 'string');
        const unique = [...new Set(references)];
        const ready = await tx.media.count({
          where: {
            id: { in: unique },
            dealerId: actor.dealerId,
            status: 'READY',
            ownerType: { in: ['DEALER_LOGO', 'DEALER_COVER'] },
          },
        });
        if (ready !== unique.length)
          throw new DomainError(
            'STOREFRONT_MEDIA_INVALID',
            'Choose ready branding images owned by your dealership.',
          );
        await tx.dealerStorefront.update({ where: { id: row.id }, data: input });
        await record(tx, actor, 'storefront.branding_updated', row.id, {
          fields: Object.keys(input),
        });
        return managementOf(await rowOf(tx, actor.dealerId), true);
      });
    },

    async setEnabled(
      actor: DealerWriteActor,
      enabled: boolean,
    ): Promise<StorefrontManagementResponse> {
      return write(actor, async (tx) => {
        const row = await rowOf(tx, actor.dealerId);
        if (!enabled) {
          await transitionStorefront(tx, actor.dealerId, 'DISABLED');
        } else if (row.status !== 'ACTIVE') {
          await transitionStorefront(tx, actor.dealerId, 'PENDING_ACTIVATION');
          if (config.STOREFRONT_DEFAULT_DOMAIN_READY) {
            await tx.storefrontDomain.updateMany({
              where: { storefrontId: row.id, kind: 'DEFAULT' },
              data: {
                status: 'ACTIVE',
                verifiedAt: new Date(),
                checkedAt: new Date(),
                certificateReady: true,
              },
            });
          }
          const domains = await tx.storefrontDomain.findMany({ where: { storefrontId: row.id } });
          const currentPrimary = domains.find((domain) => domain.isPrimary && isDomainLive(domain));
          const candidate = currentPrimary ?? domains.find((domain) => isDomainLive(domain));
          if (candidate) {
            await tx.storefrontDomain.updateMany({
              where: { storefrontId: row.id, isPrimary: true },
              data: { isPrimary: false },
            });
            await tx.storefrontDomain.update({
              where: { id: candidate.id },
              data: { isPrimary: true },
            });
            await transitionStorefront(tx, actor.dealerId, 'ACTIVE');
          }
        }
        await record(
          tx,
          actor,
          enabled ? 'storefront.activation_requested' : 'storefront.disabled',
          row.id,
          { enabled },
        );
        return managementOf(await rowOf(tx, actor.dealerId), true);
      });
    },

    async publication(
      actor: DealerWriteActor,
      listingId: string,
      input: SetPublicationInput,
    ): Promise<void> {
      await write(actor, async (tx) => {
        const locked = await tx.$queryRaw<
          { id: string }[]
        >`SELECT "id" FROM "listings" WHERE "id" = ${listingId}::uuid AND "dealerId" = ${actor.dealerId}::uuid FOR UPDATE`;
        if (!locked[0]) throw new NotFoundError('This car is unavailable.');
        await tx.listing.update({ where: { id: listingId }, data: input });
        await record(tx, actor, 'listing.publication_updated', listingId, input);
      });
    },

    async preview(actor: DealerWriteActor): Promise<StorefrontPreviewResponse> {
      const row = await withTransaction(prisma, async (tx) => {
        await authorizeDealerWrite(tx, actor, 'storefront:read');
        return rowOf(tx, actor.dealerId);
      });
      const hostname = row.domains.find((domain) => domain.kind === 'DEFAULT')?.hostname ?? '';
      const [site, inventory] = await Promise.all([
        publicRead.site(row, hostname),
        publicRead.inventory(actor.dealerId, { page: 1, limit: 6, sort: 'newest' }),
      ]);
      return { site, inventory };
    },

    async site(hostname: string): Promise<PublicStorefrontDto> {
      const row = await publicRead.resolve(hostname);
      return publicRead.site(row, hostname);
    },

    async sitemap(hostname: string, page: number) {
      const site = await publicRead.resolve(hostname);
      const where = {
        dealerId: site.dealerId,
        status: 'ACTIVE' as const,
        storefrontPublished: true,
        slug: { not: null },
        dealer: { status: 'ACTIVE' as const },
      };
      const [rows, total] = await Promise.all([
        prisma.listing.findMany({
          where,
          select: { slug: true, updatedAt: true, vehicle: { select: { updatedAt: true } } },
          orderBy: { id: 'asc' },
          skip: (page - 1) * 1000,
          take: 1000,
        }),
        prisma.listing.count({ where }),
      ]);
      return {
        entries: rows.map((row) => ({
          slug: row.slug ?? '',
          lastModified: new Date(
            Math.max(row.updatedAt.getTime(), row.vehicle.updatedAt.getTime()),
          ).toISOString(),
        })),
        page: { page, limit: 1000, total, totalPages: Math.max(1, Math.ceil(total / 1000)) },
      };
    },

    async inventory(hostname: string, query: StorefrontInventoryQuery) {
      const row = await publicRead.resolve(hostname);
      return publicRead.inventory(row.dealerId, query);
    },

    async vehicle(hostname: string, slug: string) {
      const row = await publicRead.resolve(hostname);
      return publicRead.vehicle(row.dealerId, slug);
    },

    async intent(hostname: string, listingSlug: string): Promise<StorefrontIntentResponse> {
      const row = await publicRead.resolve(hostname);
      await publicRead.vehicle(row.dealerId, listingSlug);
      const ticket = signStorefrontIntent(hostname, listingSlug, config);
      return { url: `${config.WEB_BASE_URL}/website-enquiry?ticket=${encodeURIComponent(ticket)}` };
    },

    async origin(ticket: string) {
      const payload = readStorefrontIntent(ticket, config);
      const row = await publicRead.resolve(payload.hostname);
      const vehicle = await publicRead.vehicle(row.dealerId, payload.listingSlug);
      const site = await publicRead.site(row, payload.hostname);
      return {
        listingSlug: payload.listingSlug,
        hostname: payload.hostname,
        storefrontId: row.id,
        dealerId: row.dealerId,
        context: {
          dealerName: site.name,
          vehicleTitle: vehicle.title,
          returnUrl: `https://${site.primaryHostname}/car/${encodeURIComponent(payload.listingSlug)}`,
        } satisfies StorefrontEnquiryContext,
      };
    },
  };
}

export type StorefrontService = ReturnType<typeof createStorefrontService>;
