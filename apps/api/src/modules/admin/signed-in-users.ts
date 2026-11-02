import type { AdminOverview } from '@dealers-drive/contracts';
import type { PrismaClient } from '@prisma/client';

export const SIGNED_IN_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export const SIGNED_IN_USERS_KEY = 'signedInUsers30d';
export const SIGNED_IN_USERS_LABEL = `Signed-in users (${String(SIGNED_IN_WINDOW_DAYS)}d)`;

export const signedInUsersDetail = (buyers: number, dealers: number): string =>
  `${buyers.toLocaleString('en-IN')} ${buyers === 1 ? 'buyer' : 'buyers'} · ${dealers.toLocaleString('en-IN')} ${dealers === 1 ? 'dealer' : 'dealers'}`;

export interface SignedInUserCounts {
  total: number;
  buyers: number;
  dealers: number;
}

interface SignedInUserRow {
  total: number | null;
  buyers: number | null;
  dealers: number | null;
}

export async function countSignedInUsers(
  prisma: Pick<PrismaClient, '$queryRaw'>,
  now: Date = new Date(),
): Promise<SignedInUserCounts> {
  const since = new Date(now.getTime() - SIGNED_IN_WINDOW_DAYS * DAY_MS);

  const rows = await prisma.$queryRaw<SignedInUserRow[]>`
    SELECT
      COUNT(DISTINCT s."userId")::int AS "total",
      (COUNT(DISTINCT s."userId") FILTER (WHERE s."scope" = 'CUSTOMER'))::int AS "buyers",
      (COUNT(DISTINCT s."userId") FILTER (WHERE s."scope" = 'DEALER'))::int AS "dealers"
    FROM "sessions" s
    JOIN "users" u ON u."id" = s."userId"
    WHERE s."scope" IN ('CUSTOMER', 'DEALER')
      AND s."lastSeenAt" >= ${since}
      AND u."mergedIntoId" IS NULL
  `;

  const row = rows[0];
  return {
    total: row?.total ?? 0,
    buyers: row?.buyers ?? 0,
    dealers: row?.dealers ?? 0,
  };
}

export function signedInUsersStat(counts: SignedInUserCounts): AdminOverview['stats'][number] {
  return {
    key: SIGNED_IN_USERS_KEY,
    label: SIGNED_IN_USERS_LABEL,
    value: counts.total,
    valueLabel: counts.total.toLocaleString('en-IN'),
    detail: signedInUsersDetail(counts.buyers, counts.dealers),
  };
}
