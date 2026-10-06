import { dealerSlug } from '@dealers-drive/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import { ConflictError } from '../../platform/errors.js';

const SLUG_ATTEMPTS = 50;

export async function uniqueDealerSlug(
  db: PrismaClient | Prisma.TransactionClient,
  parts: {
    legalName: string;
    city?: string | null;
    district?: string | null;
    state?: string | null;
  },
): Promise<string> {
  const base = dealerSlug(parts);

  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${String(attempt + 1)}`;
    const taken = await db.dealer.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }

  throw new ConflictError('SLUG_UNAVAILABLE', 'Could not derive a unique address for that name.');
}
