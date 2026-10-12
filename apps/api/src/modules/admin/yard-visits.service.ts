import { randomUUID } from 'node:crypto';

import {
  YARD_VISIT_OUTCOME_LABELS,
  YARD_VISIT_PHOTO_LIMIT,
  type CreateYardVisitInput,
  type YardVisitDto,
  type YardVisitPhotoCommitInput,
  type YardVisitPhotoPresignInput,
  type YardVisitPhotoPresignResponse,
  type YardVisitsResponse,
} from '@dealers-drive/contracts';
import type { DealerYardVisit, DealerYardVisitPhoto } from '@prisma/client';

import { withTransaction } from '../../platform/db/tenant-tx.js';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
} from '../../platform/errors.js';
import { sniffImageType } from '../../platform/media/sniff.js';
import { UPLOAD_INCOMPLETE } from '../../platform/messages.js';
import type { AdminPrincipal } from '../auth/auth.facade.js';
import { yardVisitPhotoKey } from '../dealers/dealers.facade.js';
import type { AdminDeps } from './admin.service.js';
import {
  DEALER_NOT_FOUND,
  YARD_VISIT_ACCESS_REVOKED,
  YARD_VISIT_FORBIDDEN,
  YARD_VISIT_NOT_FOUND,
  YARD_VISIT_PHOTO_LIMIT_REACHED,
  YARD_VISIT_PHOTO_MISMATCH,
} from './admin.messages.js';
import { assertCurrentAdmin } from './current-admin.js';

const PHOTO_URL_TTL_SECONDS = 300;
const PERMISSION = 'admin:visit:manage';

type VisitWithPhotos = DealerYardVisit & { photos: DealerYardVisitPhoto[] };

export function createYardVisitService({
  prisma,
  storage,
  audit,
}: Pick<AdminDeps, 'prisma' | 'storage' | 'audit'>) {
  function assertAllowed(admin: AdminPrincipal): void {
    if (!admin.permissions.includes(PERMISSION)) throw new ForbiddenError(YARD_VISIT_FORBIDDEN);
  }

  async function dealerSlug(dealerId: string): Promise<string> {
    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
      select: { slug: true },
    });
    if (!dealer) throw new NotFoundError(DEALER_NOT_FOUND);
    return dealer.slug;
  }

  async function visitOf(dealerId: string, visitId: string): Promise<VisitWithPhotos> {
    const visit = await prisma.dealerYardVisit.findUnique({
      where: { id: visitId },
      include: { photos: true },
    });
    if (!visit || visit.dealerId !== dealerId) throw new NotFoundError(YARD_VISIT_NOT_FOUND);
    return visit;
  }

  async function toDto(visit: VisitWithPhotos, recordedBy: string | null): Promise<YardVisitDto> {
    const media = await prisma.media.findMany({
      where: { id: { in: visit.photos.map((photo) => photo.mediaId) }, status: 'READY' },
      select: { id: true, storageKey: true },
    });
    const expiresAt = new Date(Date.now() + PHOTO_URL_TTL_SECONDS * 1000).toISOString();
    return {
      id: visit.id,
      visitedOn: visit.visitedOn.toISOString().slice(0, 10),
      outcome: visit.outcome,
      outcomeLabel: YARD_VISIT_OUTCOME_LABELS[visit.outcome],
      notes: visit.notes,
      recordedBy,
      recordedAt: visit.createdAt.toISOString(),
      photos: await Promise.all(
        media.map(async (item) => ({
          mediaId: item.id,
          url: await storage.signedReadUrl(item.storageKey, PHOTO_URL_TTL_SECONDS),
          expiresAt,
        })),
      ),
    };
  }

  async function recorderEmails(ids: string[]): Promise<Map<string, string>> {
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true },
    });
    return new Map(users.flatMap((user) => (user.email ? [[user.id, user.email]] : [])));
  }

  return {
    async list(admin: AdminPrincipal, dealerId: string): Promise<YardVisitsResponse> {
      assertAllowed(admin);
      await dealerSlug(dealerId);
      const visits = await prisma.dealerYardVisit.findMany({
        where: { dealerId },
        orderBy: [{ visitedOn: 'desc' }, { createdAt: 'desc' }],
        include: { photos: true },
      });
      const emails = await recorderEmails(visits.map((visit) => visit.recordedById));
      const data = await Promise.all(
        visits.map((visit) => toDto(visit, emails.get(visit.recordedById) ?? null)),
      );
      if (data.some((visit) => visit.photos.length > 0)) {
        await audit.recordDetached({
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId,
          action: 'dealer.yard_visits.viewed',
          entityType: 'Dealer',
          entityId: dealerId,
        });
      }
      return { data };
    },

    async create(
      admin: AdminPrincipal,
      dealerId: string,
      input: CreateYardVisitInput,
    ): Promise<YardVisitDto> {
      const visit = await withTransaction(prisma, async (tx) => {
        await assertCurrentAdmin(
          tx,
          admin,
          PERMISSION,
          YARD_VISIT_FORBIDDEN,
          YARD_VISIT_ACCESS_REVOKED,
        );
        const dealer = await tx.dealer.findUnique({
          where: { id: dealerId },
          select: { id: true },
        });
        if (!dealer) throw new NotFoundError(DEALER_NOT_FOUND);
        const row = await tx.dealerYardVisit.create({
          data: {
            dealerId,
            visitedOn: new Date(`${input.visitedOn}T00:00:00Z`),
            outcome: input.outcome,
            notes: input.notes ?? null,
            recordedById: admin.userId,
          },
          include: { photos: true },
        });
        await audit.record(tx, {
          actorType: 'ADMIN',
          actorId: admin.userId,
          dealerId,
          action: 'dealer.yard_visit_recorded',
          entityType: 'DealerYardVisit',
          entityId: row.id,
          after: { visitedOn: input.visitedOn, outcome: input.outcome },
        });
        return row;
      });
      return toDto(visit, admin.email);
    },

    async presignPhoto(
      admin: AdminPrincipal,
      dealerId: string,
      visitId: string,
      input: YardVisitPhotoPresignInput,
    ): Promise<YardVisitPhotoPresignResponse> {
      assertAllowed(admin);
      const slug = await dealerSlug(dealerId);
      const visit = await visitOf(dealerId, visitId);
      if (visit.photos.length >= YARD_VISIT_PHOTO_LIMIT) {
        throw new ConflictError('YARD_VISIT_PHOTO_LIMIT', YARD_VISIT_PHOTO_LIMIT_REACHED);
      }
      const mediaId = randomUUID();
      const key = yardVisitPhotoKey(slug, visit.id, mediaId);
      await prisma.media.create({
        data: {
          id: mediaId,
          dealerId,
          ownerType: 'DEALER_YARD_VISIT',
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

    async commitPhoto(
      admin: AdminPrincipal,
      dealerId: string,
      visitId: string,
      input: YardVisitPhotoCommitInput,
    ): Promise<YardVisitDto> {
      assertAllowed(admin);
      const visit = await visitOf(dealerId, visitId);
      const media = await prisma.media.findUnique({ where: { id: input.mediaId } });
      if (
        !media ||
        media.dealerId !== dealerId ||
        media.ownerType !== 'DEALER_YARD_VISIT' ||
        !media.storageKey.includes(`/yard-visits/${visit.id}/`)
      ) {
        throw new NotFoundError(YARD_VISIT_NOT_FOUND);
      }
      if (!visit.photos.some((photo) => photo.mediaId === media.id)) {
        if (media.status !== 'PENDING') throw new NotFoundError(YARD_VISIT_NOT_FOUND);
        const body = (await storage.head(media.storageKey))
          ? await storage.get(media.storageKey)
          : null;
        if (!body) throw new DomainError('UPLOAD_MISSING', UPLOAD_INCOMPLETE);
        if (body.length !== media.bytes || sniffImageType(body) !== media.mimeType) {
          await prisma.media.update({ where: { id: media.id }, data: { status: 'FAILED' } });
          await storage.delete(media.storageKey);
          throw new DomainError('YARD_VISIT_PHOTO_MISMATCH', YARD_VISIT_PHOTO_MISMATCH);
        }
        await withTransaction(prisma, async (tx) => {
          await assertCurrentAdmin(
            tx,
            admin,
            PERMISSION,
            YARD_VISIT_FORBIDDEN,
            YARD_VISIT_ACCESS_REVOKED,
          );
          await tx.$queryRaw`SELECT "id" FROM "dealer_yard_visits" WHERE "id" = ${visit.id}::uuid FOR UPDATE`;
          const count = await tx.dealerYardVisitPhoto.count({ where: { visitId: visit.id } });
          if (count >= YARD_VISIT_PHOTO_LIMIT) {
            throw new ConflictError('YARD_VISIT_PHOTO_LIMIT', YARD_VISIT_PHOTO_LIMIT_REACHED);
          }
          await tx.media.update({ where: { id: media.id }, data: { status: 'READY' } });
          await tx.dealerYardVisitPhoto.create({ data: { visitId: visit.id, mediaId: media.id } });
          await audit.record(tx, {
            actorType: 'ADMIN',
            actorId: admin.userId,
            dealerId,
            action: 'dealer.yard_visit_photo_added',
            entityType: 'DealerYardVisit',
            entityId: visit.id,
            after: { mediaId: media.id, mimeType: media.mimeType },
          });
        });
      }
      const emails = await recorderEmails([visit.recordedById]);
      return toDto(await visitOf(dealerId, visitId), emails.get(visit.recordedById) ?? null);
    },
  };
}

export type YardVisitService = ReturnType<typeof createYardVisitService>;
