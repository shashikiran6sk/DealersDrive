import type { Prisma, PrismaClient } from '@prisma/client';

import { DomainError } from '../../platform/errors.js';

/**
 * The one rule every write that stores a dealer's number has to obey (**R39**).
 *
 * **`users.phone` is written by `phone.service.ts` and by nothing else.** It is
 * the same shape of invariant as rule 5 — a listing's status changes only
 * through `transition()` — and it exists for the same reason: a column that
 * several call sites may set is a column whose meaning drifts. Here the meaning
 * is specific and worth protecting. `users.phone` holds a number somebody
 * proved they hold; a number somebody typed is not the same fact, and once both
 * can land in the column there is no way to tell them apart afterwards.
 *
 * So onboarding and the profile edit no longer *set* the number. They assert
 * that the number they were handed is already the one on the session's user
 * row, verified — and refuse if it is not. That makes the OTP round trip
 * unskippable by construction rather than by a check somebody has to remember
 * to add to the next write path.
 *
 * The uniqueness refusal moved with it. A number another user holds can never
 * become this user's verified number, so `PHONE_ALREADY_REGISTERED` is raised
 * where the claim is made — on step 1, against the box the dealer typed into —
 * rather than two steps later when the dealership is created.
 */
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
