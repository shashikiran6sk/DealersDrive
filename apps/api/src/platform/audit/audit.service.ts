import { Prisma, type PrismaClient } from '@prisma/client';

import { getContext } from '../../middleware/request-context.js';
import type { Tx } from '../db/prisma.js';
import { logger } from '../telemetry/logger.js';

/**
 * Every admin write, and every cross-tenant read of private data, lands here
 * with the actor's identity (ARCHITECTURE §7 layer 4, §21).
 */
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
  /** Inside a transaction, so the record cannot outlive a rolled-back write. */
  record(tx: Tx, entry: AuditEntry): Promise<void>;
  /** Outside one, for reads — an audit row for a read has nothing to roll back with. */
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
      before: (entry.before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
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
        // Never fail a request because the audit write failed; alert instead.
        logger.error({ err: error, action: entry.action }, 'audit write failed');
      }
    },
  };
}
