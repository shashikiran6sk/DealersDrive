import type { Prisma, PrismaClient, VehicleReport } from '@prisma/client';

import type { RcRecords } from '../../platform/rc/rc.port.js';

/**
 * Vehicle records, append-only (ARCHITECTURE §6.3).
 *
 * There is no `update` and no `delete` on this repository, and their absence
 * is the design. A published report is a claim we made on a date; when a buyer
 * says "your page said this car was clear", the answer has to be the exact row
 * they saw. An updated-in-place row cannot produce that, and a repository with
 * an `update` method invites one.
 */
export function createReportsRepository(prisma: PrismaClient) {
  return {
    /** The current report — newest row wins, served by the DESC index. */
    async latestForVehicle(vehicleId: string): Promise<VehicleReport | null> {
      return prisma.vehicleReport.findFirst({
        where: { vehicleId },
        orderBy: { fetchedAt: 'desc' },
      });
    },

    /**
     * The current report for several vehicles at once.
     *
     * A search results page renders up to 24 cards. Reading one report per
     * card would be 24 round trips to decorate a list — this is one, and the
     * newest-per-vehicle reduction happens in memory over an already-indexed
     * ordering.
     */
    async latestForVehicles(vehicleIds: string[]): Promise<Map<string, VehicleReport>> {
      if (vehicleIds.length === 0) return new Map();

      const rows = await prisma.vehicleReport.findMany({
        where: { vehicleId: { in: vehicleIds } },
        orderBy: { fetchedAt: 'desc' },
      });

      const newest = new Map<string, VehicleReport>();
      for (const row of rows) {
        if (!newest.has(row.vehicleId)) newest.set(row.vehicleId, row);
      }
      return newest;
    },

    /**
     * Write a new report row. Never updates one.
     *
     * Accepts a transaction client so a draft and its first report land
     * together — a vehicle created from a lookup must never exist for a moment
     * with no record of what that lookup said.
     */
    async append(
      tx: Prisma.TransactionClient | PrismaClient,
      input: { vehicleId: string; dealerId: string; provider: string; records: RcRecords },
    ): Promise<VehicleReport> {
      const { records } = input;
      const unpaid = records.challans.filter((row) => row.status === 'UNPAID');

      return tx.vehicleReport.create({
        data: {
          vehicleId: input.vehicleId,
          dealerId: input.dealerId,
          provider: input.provider,
          blacklistStatus: records.blacklistStatus,
          blacklistReasons: records.blacklistReasons,
          nocIssuedTo: records.nocIssuedTo,
          challansAvailable: records.challansAvailable,
          challanCount: records.challans.length,
          challanUnpaidCount: unpaid.length,
          // Aggregated on write rather than on every read: the public page
          // renders this number on every card, and summing a Json array in the
          // request path to produce it would be work repeated forever.
          challanOutstandingPaise: BigInt(
            unpaid.reduce((total, row) => total + row.amountPaise, 0),
          ),
          challans: records.challans as unknown as Prisma.InputJsonValue,
          financed: records.financed,
          rcStatus: records.rcStatus,
          insuranceUpto: toDate(records.insuranceUpto),
          fitnessUpto: toDate(records.fitnessUpto),
          pucUpto: toDate(records.pucUpto),
          taxUpto: toDate(records.taxUpto),
        },
      });
    },

    /**
     * Marks the row that was live on a public page. Idempotent.
     *
     * The one write that touches an existing row, and it records *our*
     * publishing act rather than changing anything the provider said — the
     * record itself stays exactly as fetched.
     */
    async markPublished(reportId: string): Promise<void> {
      await prisma.vehicleReport.updateMany({
        where: { id: reportId, publishedAt: null },
        data: { publishedAt: new Date() },
      });
    },
  };
}

export type ReportsRepository = ReturnType<typeof createReportsRepository>;

function toDate(iso: string | null): Date | null {
  if (!iso) return null;
  const value = new Date(iso);
  return Number.isNaN(value.getTime()) ? null : value;
}
