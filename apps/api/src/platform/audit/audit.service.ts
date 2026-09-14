import { Prisma, type PrismaClient } from '@prisma/client';

import { getContext } from '../../middleware/request-context.js';
import type { Tx } from '../db/prisma.js';
import { logger } from '../telemetry/logger.js';

export interface AuditEntry {
  actorType: 'DEALER' | 'ADMIN' | 'SYSTEM';
  actorId?: string | null;
  dealerId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

export interface AuditService {
  record(tx: Tx, entry: AuditEntry): Promise<void>;
  recordDetached(entry: AuditEntry): Promise<void>;
}

export function createAuditService(prisma: PrismaClient): AuditService {
  function toRow(entry: AuditEntry) {
    const context = getContext();
    return {
      actorType: entry.actorType,
      actorId: entry.actorId ?? null,
      dealerId: entry.dealerId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Prisma's InputJsonValue does not accept its own JsonNull
      before: (entry.before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Prisma's InputJsonValue does not accept its own JsonNull
      after: (entry.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      ip: context?.ip ?? null,
      traceId: context?.traceId ?? null,
    };
  }

  return {
    async record(tx, entry) {
      await tx.auditLog.create({ data: toRow(entry) });
    },

    async recordDetached(entry) {
      try {
        await prisma.auditLog.create({ data: toRow(entry) });
      } catch (error) {
        logger.error({ err: error, action: entry.action }, 'audit write failed');
      }
    },
  };
}
