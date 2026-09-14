import type { Prisma, PrismaClient } from '@prisma/client';

import { DomainError } from '../../platform/errors.js';

export async function assertPhoneVerified(
  client: PrismaClient | Prisma.TransactionClient,
  userId: string,
  phone: string,
  field: string,
): Promise<void> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { phone: true, phoneVerifiedAt: true },
  });

  if (user?.phone === phone && user.phoneVerifiedAt !== null) return;

  throw new DomainError(
    'PHONE_NOT_VERIFIED',
    'Verify this mobile number before continuing — we send a one-time code to it.',
    {
      errors: [
        {
          field,
          code: 'PHONE_NOT_VERIFIED',
          message: 'Verify this number first.',
        },
      ],
    },
  );
}
