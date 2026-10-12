import type { DealerDocCategory, DealerDocType } from '@prisma/client';

export const SEEDED_DOCUMENTS: readonly (readonly [DealerDocCategory, DealerDocType])[] = [
  ['PERSONAL_IDENTITY', 'PAN_CARD'],
  ['BUSINESS_IDENTITY', 'GST_CERTIFICATE'],
];
