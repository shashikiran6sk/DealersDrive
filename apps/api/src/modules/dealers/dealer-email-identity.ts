import { ConflictError, errorCode, isRecord } from '../../platform/errors.js';
import { logger } from '../../platform/telemetry/logger.js';
import type { PrismaClient } from '@prisma/client';

export const DEALER_EMAIL_TAKEN =
  'This email address is already associated with a dealer account. Please use another email or contact Dealers-Drive support.';

export function normaliseDealerEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emailTaken(field: string): ConflictError {
  logger.info({ event: 'dealer.email_conflict', field }, 'primary dealer email conflict');
  return new ConflictError('DEALER_EMAIL_TAKEN', DEALER_EMAIL_TAKEN, {
    errors: [{ field, code: 'DEALER_EMAIL_TAKEN', message: DEALER_EMAIL_TAKEN }],
  });
}

export async function assertDealerEmailFree(prisma: PrismaClient, email: string): Promise<void> {
  const dealer = await prisma.dealer.findUnique({
    where: { primaryOwnerEmail: normaliseDealerEmail(email) },
    select: { id: true },
  });
  if (dealer) throw emailTaken('body.email');
}

export async function withDealerEmailConflict<T>(
  work: () => Promise<T>,
  field = 'body.email',
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const meta = isRecord(error) ? error.meta : undefined;
    if (errorCode(error) !== 'P2002' || !JSON.stringify(meta)?.includes('primaryOwnerEmail')) {
      throw error;
    }
    throw emailTaken(field);
  }
}
