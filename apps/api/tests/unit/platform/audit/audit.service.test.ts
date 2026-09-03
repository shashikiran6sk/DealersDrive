import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { runWithContext } from '../../../../src/middleware/request-context.js';
import {
  createAuditService,
  type AuditEntry,
} from '../../../../src/platform/audit/audit.service.js';
import type { Tx } from '../../../../src/platform/db/prisma.js';
import { logger } from '../../../../src/platform/telemetry/logger.js';

/**
 * Unit tests for `src/platform/audit/audit.service.ts`.
 *
 * Layer 4 of the tenancy model (ARCHITECTURE §7). Three behaviours matter:
 *
 *   1. `record` writes **through the caller's transaction**, so an audit row
 *      cannot outlive a write that rolled back.
 *   2. `recordDetached` **never fails the request** — a failed audit write on a
 *      read path must alert, not 500. That path is unreachable from the
 *      integration suite without breaking the database on purpose, which is
 *      exactly why it is tested here.
 *   3. The actor's ip and traceId are picked up from the request context rather
 *      than passed by every call site.
 */
function entry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    actorType: 'ADMIN',
    actorId: '11111111-0000-4000-8000-000000000000',
    dealerId: '22222222-0000-4000-8000-000000000000',
    action: 'listing.approve',
    entityType: 'Listing',
    entityId: '33333333-0000-4000-8000-000000000000',
    ...overrides,
  };
}

function fakes() {
  const rows: Record<string, unknown>[] = [];
  const create = (args: { data: Record<string, unknown> }) => {
    rows.push(args.data);
    return Promise.resolve({});
  };

  const prisma = { auditLog: { create } } as unknown as PrismaClient;
  const tx = { auditLog: { create } } as unknown as Tx;

  return { prisma, tx, rows };
}

describe('record', () => {
  it('writes through the transaction it was given', async () => {
    const { prisma, tx, rows } = fakes();

    await createAuditService(prisma).record(tx, entry());

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorType: 'ADMIN',
      action: 'listing.approve',
      entityType: 'Listing',
    });
  });

  it('records the actor and the dealer the action touched', async () => {
    const { prisma, tx, rows } = fakes();

    await createAuditService(prisma).record(tx, entry());

    expect(rows[0]?.actorId).toBe('11111111-0000-4000-8000-000000000000');
    expect(rows[0]?.dealerId).toBe('22222222-0000-4000-8000-000000000000');
  });

  it('normalises a missing actor and dealer to null', async () => {
    const { prisma, tx, rows } = fakes();

    await createAuditService(prisma).record(
      tx,
      entry({ actorType: 'SYSTEM', actorId: undefined, dealerId: undefined }),
    );

    // Explicit null, not undefined: Prisma would omit the column, and a nullable
    // column that is sometimes absent makes the log harder to query, not easier.
    expect(rows[0]?.actorId).toBeNull();
    expect(rows[0]?.dealerId).toBeNull();
  });

  it('stores before and after states when given them', async () => {
    const { prisma, tx, rows } = fakes();

    await createAuditService(prisma).record(
      tx,
      entry({ before: { status: 'IN_REVIEW' }, after: { status: 'APPROVED' } }),
    );

    expect(rows[0]?.before).toEqual({ status: 'IN_REVIEW' });
    expect(rows[0]?.after).toEqual({ status: 'APPROVED' });
  });

  it('uses JSON null rather than SQL NULL when there is no state to record', async () => {
    const { prisma, tx, rows } = fakes();

    await createAuditService(prisma).record(tx, entry());

    // `Prisma.JsonNull` writes the JSON value `null` into a jsonb column;
    // `DbNull` would write SQL NULL, and the two are not the same when reading
    // the log back with a jsonb operator.
    expect(rows[0]?.before).toBe(Prisma.JsonNull);
    expect(rows[0]?.after).toBe(Prisma.JsonNull);
  });

  it('picks up the ip and traceId from the request context', async () => {
    const { prisma, tx, rows } = fakes();

    await runWithContext({ traceId: 'trace-audit', ip: '203.0.113.9' }, () =>
      createAuditService(prisma).record(tx, entry()),
    );

    // No call site passes these; a support ticket quoting a traceId has to be
    // joinable to the audit row for the action it is asking about.
    expect(rows[0]).toMatchObject({ ip: '203.0.113.9', traceId: 'trace-audit' });
  });

  it('records null for ip and traceId outside a request', async () => {
    const { prisma, tx, rows } = fakes();

    await createAuditService(prisma).record(tx, entry({ actorType: 'SYSTEM' }));

    // Expiry sweeps run on a timer, with no request to attribute them to.
    expect(rows[0]?.ip).toBeNull();
    expect(rows[0]?.traceId).toBeNull();
  });

  it('propagates a write failure, so the transaction rolls back with it', async () => {
    const prisma = {} as PrismaClient;
    const tx = {
      auditLog: { create: () => Promise.reject(new Error('constraint violation')) },
    } as unknown as Tx;

    // The opposite of `recordDetached`: inside a transaction, an unrecorded
    // admin write must not be allowed to commit.
    await expect(createAuditService(prisma).record(tx, entry())).rejects.toThrow(
      'constraint violation',
    );
  });
});

describe('recordDetached', () => {
  it('writes through the client rather than a transaction', async () => {
    const { prisma, rows } = fakes();

    await createAuditService(prisma).recordDetached(
      entry({ action: 'dealer.document.read', entityType: 'DealerDocument' }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe('dealer.document.read');
  });

  it('never fails the request when the audit write fails', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const prisma = {
      auditLog: { create: () => Promise.reject(new Error('disk full')) },
    } as unknown as PrismaClient;

    // A read succeeded. Refusing to serve it because the log write failed would
    // trade an observability gap for an outage.
    await expect(createAuditService(prisma).recordDetached(entry())).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[1]).toBe('audit write failed');
    error.mockRestore();
  });

  it('names the action in the alert, so the gap is identifiable', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const prisma = {
      auditLog: { create: () => Promise.reject(new Error('disk full')) },
    } as unknown as PrismaClient;

    await createAuditService(prisma).recordDetached(entry({ action: 'kyc.document.download' }));

    expect(error.mock.calls[0]?.[0]).toMatchObject({ action: 'kyc.document.download' });
    error.mockRestore();
  });

  it('carries the request context the same way as `record`', async () => {
    const { prisma, rows } = fakes();

    await runWithContext({ traceId: 'trace-read', ip: '198.51.100.7' }, () =>
      createAuditService(prisma).recordDetached(entry()),
    );

    expect(rows[0]).toMatchObject({ ip: '198.51.100.7', traceId: 'trace-read' });
  });
});
