import { randomUUID } from 'node:crypto';

import {
  PORTFOLIO_PHOTO_LIMIT,
  PORTFOLIO_PHOTO_STATUS_LABELS,
  type AdminPortfolioPhoto,
  type AdminPortfolioQueue,
  type DealerPortfolioPhoto,
  type DealerPortfolioResponse,
  type PortfolioDecisionResponse,
  type PortfolioModerationQuery,
  type PortfolioPhotoCommitInput,
  type PortfolioPhotoPresignInput,
  type PortfolioPhotoPresignResponse,
} from '@dealers-drive/contracts';
import type { DealerPortfolioPhoto as PhotoRow, Prisma, PrismaClient } from '@prisma/client';

import { withTransaction } from '../../platform/db/tenant-tx.js';
import type { Tx } from '../../platform/db/prisma.js';
import type { AuditService } from '../../platform/audit/audit.service.js';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
} from '../../platform/errors.js';
import { sniffImageType } from '../../platform/media/sniff.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
import type { AdminPrincipal } from '../auth/auth.facade.js';
import { portfolioKey } from './dealer-storage-keys.js';
import {
  PORTFOLIO_CONTENT_MISMATCH,
  PORTFOLIO_FULL,
  PORTFOLIO_MODERATION_FORBIDDEN,
  PORTFOLIO_PHOTO_DECIDED,
  PORTFOLIO_PHOTO_NOT_FOUND,
  PORTFOLIO_PHOTO_NOT_PUBLISHED,
  PORTFOLIO_REPLACE_TARGET,
  PORTFOLIO_REPLACEMENT_PENDING,
} from './dealers.messages.js';
import { UPLOAD_INCOMPLETE } from '../../platform/messages.js';

const PREVIEW_TTL_SECONDS = 300;
const VISIBLE: PhotoRow['status'][] = ['PENDING', 'APPROVED', 'REJECTED'];
const COUNTED: Prisma.DealerPortfolioPhotoWhereInput = {
  OR: [{ status: 'APPROVED' }, { status: 'PENDING', replacesId: null }],
};

export interface PortfolioDeps {
  prisma: PrismaClient;
  storage: StoragePort;
  audit: AuditService;
}

type WithMedia<T> = T & { media: { storageKey: string } | null };
type PhotoWithMedia = WithMedia<PhotoRow>;

export function createDealerPortfolioService({ prisma, storage, audit }: PortfolioDeps) {
  async function slugOf(dealerId: string, tx?: Tx): Promise<string> {
    const dealer = await (tx ?? prisma).dealer.findUnique({
      where: { id: dealerId },
      select: { slug: true },
    });
    if (!dealer) throw new NotFoundError(PORTFOLIO_PHOTO_NOT_FOUND);
    return dealer.slug;
  }

  async function withMedia<T extends PhotoRow>(rows: T[]): Promise<WithMedia<T>[]> {
    const media = await prisma.media.findMany({
      where: { id: { in: rows.map((row) => row.mediaId) } },
      select: { id: true, storageKey: true },
    });
    return rows.map((row) => ({
      ...row,
      media: media.find((item) => item.id === row.mediaId) ?? null,
    }));
  }

  async function toDto(row: PhotoWithMedia): Promise<DealerPortfolioPhoto> {
    return {
      id: row.id,
      status: row.status,
      statusLabel: PORTFOLIO_PHOTO_STATUS_LABELS[row.status],
      previewUrl: row.media
        ? await storage.signedReadUrl(row.media.storageKey, PREVIEW_TTL_SECONDS)
        : null,
      caption: row.caption,
      replacesId: row.replacesId,
      position: row.position,
      rejectionReason: row.rejectionReason,
      submittedAt: row.createdAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    };
  }

  async function discard(mediaId: string): Promise<void> {
    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) return;
    await prisma.media.update({ where: { id: mediaId }, data: { status: 'ORPHAN' } });
    await storage.delete(media.storageKey);
  }

  function assertModerator(admin: AdminPrincipal): void {
    if (!admin.permissions.includes('admin:portfolio:moderate')) {
      throw new ForbiddenError(PORTFOLIO_MODERATION_FORBIDDEN);
    }
  }

  async function lockPhoto(tx: Tx, id: string): Promise<PhotoRow> {
    await tx.$queryRaw`SELECT "id" FROM "dealer_portfolio_photos" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const row = await tx.dealerPortfolioPhoto.findUnique({ where: { id } });
    if (!row) throw new NotFoundError(PORTFOLIO_PHOTO_NOT_FOUND);
    return row;
  }

  async function activeCount(tx: Tx, dealerId: string): Promise<number> {
    return tx.dealerPortfolioPhoto.count({
      where: { dealerId, ...COUNTED },
    });
  }

  async function nextPosition(tx: Tx, dealerId: string): Promise<number> {
    const last = await tx.dealerPortfolioPhoto.findFirst({
      where: { dealerId, status: 'APPROVED' },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return last ? last.position + 1 : 0;
  }

  return {
    async list(dealerId: string): Promise<DealerPortfolioResponse> {
      const rows = await prisma.dealerPortfolioPhoto.findMany({
        where: { dealerId, status: { in: VISIBLE } },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      });
      const data = await Promise.all((await withMedia(rows)).map(toDto));
      const active = rows.filter(
        (row) => row.status === 'APPROVED' || (row.status === 'PENDING' && !row.replacesId),
      ).length;
      return { data, limit: PORTFOLIO_PHOTO_LIMIT, canAdd: active < PORTFOLIO_PHOTO_LIMIT };
    },

    async presign(
      dealerId: string,
      input: PortfolioPhotoPresignInput,
    ): Promise<PortfolioPhotoPresignResponse> {
      const slug = await slugOf(dealerId);
      if (!input.replacesId) {
        const current = await prisma.dealerPortfolioPhoto.count({
          where: { dealerId, ...COUNTED },
        });
        if (current >= PORTFOLIO_PHOTO_LIMIT)
          throw new ConflictError('PORTFOLIO_FULL', PORTFOLIO_FULL);
      }
      const mediaId = randomUUID();
      const key = portfolioKey(slug, mediaId);
      await prisma.media.create({
        data: {
          id: mediaId,
          dealerId,
          ownerType: 'DEALER_PORTFOLIO',
          storageKey: key,
          mimeType: input.mimeType,
          bytes: input.bytes,
          fileName: input.fileName,
          status: 'PENDING',
        },
      });
      const presigned = await storage.presignPut({
        key,
        contentType: input.mimeType,
        contentLength: input.bytes,
      });
      return {
        mediaId,
        uploadUrl: presigned.uploadUrl,
        method: 'PUT',
        headers: presigned.headers,
        expiresInSeconds: presigned.expiresInSeconds,
      };
    },

    async commit(
      dealerId: string,
      userId: string,
      input: PortfolioPhotoCommitInput,
    ): Promise<DealerPortfolioPhoto> {
      const media = await prisma.media.findUnique({ where: { id: input.mediaId } });
      if (!media || media.dealerId !== dealerId || media.ownerType !== 'DEALER_PORTFOLIO') {
        throw new NotFoundError(PORTFOLIO_PHOTO_NOT_FOUND);
      }
      const existing = await prisma.dealerPortfolioPhoto.findUnique({
        where: { mediaId: media.id },
      });
      if (existing) return toDto({ ...existing, media: { storageKey: media.storageKey } });
      if (media.status !== 'PENDING') throw new NotFoundError(PORTFOLIO_PHOTO_NOT_FOUND);

      const object = await storage.head(media.storageKey);
      const body = object ? await storage.get(media.storageKey) : null;
      if (!object || !body) throw new DomainError('UPLOAD_MISSING', UPLOAD_INCOMPLETE);
      if (body.length !== media.bytes || sniffImageType(body) !== media.mimeType) {
        await prisma.media.update({ where: { id: media.id }, data: { status: 'FAILED' } });
        await storage.delete(media.storageKey);
        throw new DomainError('PORTFOLIO_CONTENT_MISMATCH', PORTFOLIO_CONTENT_MISMATCH);
      }

      const created = await withTransaction(prisma, async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "dealers" WHERE "id" = ${dealerId}::uuid FOR UPDATE`;
        let position: number;
        if (input.replacesId) {
          const target = await tx.dealerPortfolioPhoto.findUnique({
            where: { id: input.replacesId },
          });
          if (!target || target.dealerId !== dealerId || target.status !== 'APPROVED') {
            throw new ConflictError('PORTFOLIO_REPLACE_TARGET', PORTFOLIO_REPLACE_TARGET);
          }
          const pending = await tx.dealerPortfolioPhoto.count({
            where: { replacesId: target.id, status: 'PENDING' },
          });
          if (pending > 0) {
            throw new ConflictError('PORTFOLIO_REPLACEMENT_PENDING', PORTFOLIO_REPLACEMENT_PENDING);
          }
          position = target.position;
        } else {
          if ((await activeCount(tx, dealerId)) >= PORTFOLIO_PHOTO_LIMIT) {
            throw new ConflictError('PORTFOLIO_FULL', PORTFOLIO_FULL);
          }
          position = await nextPosition(tx, dealerId);
        }
        await tx.media.update({ where: { id: media.id }, data: { status: 'READY' } });
        const row = await tx.dealerPortfolioPhoto.create({
          data: {
            dealerId,
            mediaId: media.id,
            status: 'PENDING',
            replacesId: input.replacesId ?? null,
            position,
            caption: input.caption ?? null,
            submittedById: userId,
          },
        });
        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: userId,
          dealerId,
          action: 'portfolio.photo_submitted',
          entityType: 'DealerPortfolioPhoto',
          entityId: row.id,
          after: { status: 'PENDING', replacesId: row.replacesId, mimeType: media.mimeType },
        });
        return row;
      });
      return toDto({ ...created, media: { storageKey: media.storageKey } });
    },

    async remove(dealerId: string, userId: string, photoId: string): Promise<void> {
      const removed = await withTransaction(prisma, async (tx) => {
        const row = await lockPhoto(tx, photoId);
        if (row.dealerId !== dealerId || row.status === 'REMOVED') {
          throw new NotFoundError(PORTFOLIO_PHOTO_NOT_FOUND);
        }
        if (row.status === 'APPROVED') {
          await tx.dealerPortfolioPhoto.update({
            where: { id: row.id },
            data: { status: 'REMOVED' },
          });
          await tx.dealerPortfolioPhoto.updateMany({
            where: { replacesId: row.id, status: 'PENDING' },
            data: { replacesId: null },
          });
        } else {
          await tx.dealerPortfolioPhoto.delete({ where: { id: row.id } });
        }
        await audit.record(tx, {
          actorType: 'DEALER',
          actorId: userId,
          dealerId,
          action: 'portfolio.photo_removed',
          entityType: 'DealerPortfolioPhoto',
          entityId: row.id,
          before: { status: row.status },
          after: { status: 'REMOVED' },
        });
        return row;
      });
      await discard(removed.mediaId);
    },

    async forDealer(dealerId: string): Promise<DealerPortfolioPhoto[]> {
      const rows = await prisma.dealerPortfolioPhoto.findMany({
        where: { dealerId, status: { in: ['PENDING', 'APPROVED'] } },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      });
      return Promise.all((await withMedia(rows)).map(toDto));
    },

    async queue(
      admin: AdminPrincipal,
      query: PortfolioModerationQuery,
    ): Promise<AdminPortfolioQueue> {
      assertModerator(admin);
      const rows = await prisma.dealerPortfolioPhoto.findMany({
        where: { status: query.status },
        orderBy: { createdAt: 'asc' },
        take: 100,
        include: { dealer: { select: { brandName: true, slug: true } } },
      });
      const replaced = await withMedia(
        await prisma.dealerPortfolioPhoto.findMany({
          where: { id: { in: rows.flatMap((row) => (row.replacesId ? [row.replacesId] : [])) } },
        }),
      );
      const data: AdminPortfolioPhoto[] = await Promise.all(
        (await withMedia(rows)).map(async (row) => {
          const target = replaced.find((item) => item.id === row.replacesId);
          return {
            ...(await toDto(row)),
            dealerId: row.dealerId,
            dealerName: row.dealer.brandName,
            dealerSlug: row.dealer.slug,
            replacesPreviewUrl:
              target?.media && target.status === 'APPROVED'
                ? await storage.signedReadUrl(target.media.storageKey, PREVIEW_TTL_SECONDS)
                : null,
          };
        }),
      );
      return { data };
    },

    async approve(admin: AdminPrincipal, photoId: string): Promise<PortfolioDecisionResponse> {
      assertModerator(admin);
      const outcome = await withTransaction(prisma, async (tx) => {
        const row = await lockPhoto(tx, photoId);
        if (row.status !== 'PENDING') {
          throw new ConflictError('PORTFOLIO_PHOTO_DECIDED', PORTFOLIO_PHOTO_DECIDED);
        }
        const target = row.replacesId ? await lockPhoto(tx, row.replacesId) : null;
        const replacing = target?.status === 'APPROVED' ? target : null;
        const now = new Date();
        if (replacing) {
          await tx.dealerPortfolioPhoto.update({
            where: { id: replacing.id },
            data: { status: 'REMOVED' },
          });
        }
        await tx.dealerPortfolioPhoto.update({
          where: { id: row.id },
          data: {
            status: 'APPROVED',
            reviewedById: admin.userId,
            reviewedAt: now,
            position: replacing ? replacing.position : await nextPosition(tx, row.dealerId),
          },
        });
        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId: row.dealerId,
          action: 'portfolio.photo_approved',
          entityType: 'DealerPortfolioPhoto',
          entityId: row.id,
          before: { status: 'PENDING' },
          after: { status: 'APPROVED', replacedId: replacing?.id ?? null },
        });
        return { replaced: replacing };
      });
      if (outcome.replaced) await discard(outcome.replaced.mediaId);
      return { id: photoId, status: 'APPROVED', replacedId: outcome.replaced?.id ?? null };
    },

    async reject(
      admin: AdminPrincipal,
      photoId: string,
      reason: string,
    ): Promise<PortfolioDecisionResponse> {
      assertModerator(admin);
      await withTransaction(prisma, async (tx) => {
        const row = await lockPhoto(tx, photoId);
        if (row.status !== 'PENDING') {
          throw new ConflictError('PORTFOLIO_PHOTO_DECIDED', PORTFOLIO_PHOTO_DECIDED);
        }
        await tx.dealerPortfolioPhoto.update({
          where: { id: row.id },
          data: {
            status: 'REJECTED',
            rejectionReason: reason,
            reviewedById: admin.userId,
            reviewedAt: new Date(),
          },
        });
        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId: row.dealerId,
          action: 'portfolio.photo_rejected',
          entityType: 'DealerPortfolioPhoto',
          entityId: row.id,
          before: { status: 'PENDING' },
          after: { status: 'REJECTED', reason, replacesId: row.replacesId },
        });
      });
      return { id: photoId, status: 'REJECTED', replacedId: null };
    },

    async takeDown(
      admin: AdminPrincipal,
      photoId: string,
      reason: string,
    ): Promise<PortfolioDecisionResponse> {
      assertModerator(admin);
      const removed = await withTransaction(prisma, async (tx) => {
        const row = await lockPhoto(tx, photoId);
        if (row.status !== 'APPROVED') {
          throw new ConflictError('PORTFOLIO_PHOTO_NOT_PUBLISHED', PORTFOLIO_PHOTO_NOT_PUBLISHED);
        }
        await tx.dealerPortfolioPhoto.update({
          where: { id: row.id },
          data: { status: 'REMOVED' },
        });
        await tx.dealerPortfolioPhoto.updateMany({
          where: { replacesId: row.id, status: 'PENDING' },
          data: { replacesId: null },
        });
        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId: row.dealerId,
          action: 'portfolio.photo_taken_down',
          entityType: 'DealerPortfolioPhoto',
          entityId: row.id,
          before: { status: 'APPROVED' },
          after: { status: 'REMOVED', reason },
        });
        return row;
      });
      await discard(removed.mediaId);
      return { id: photoId, status: 'REMOVED', replacedId: null };
    },
  };
}

export type DealerPortfolioService = ReturnType<typeof createDealerPortfolioService>;
