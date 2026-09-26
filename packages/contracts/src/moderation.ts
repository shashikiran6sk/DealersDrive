import { z } from 'zod';

import { CursorPage } from './common.js';
import { ListingStatus, StatusTone } from './enums.js';

/**
 * The admin side of a listing (**F069**, **F070**, as revised by **R45**).
 *
 * A third vehicle DTO, deliberately separate from the dealer's and the
 * buyer's: a moderator sees which dealership, where, since when, and — once
 * the admin media model lands — whether the car has been photographed.
 */
export const AdminListingQuery = z
  .object({
    status: ListingStatus.optional(),
    q: z.string().trim().min(1).max(60).optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type AdminListingQuery = z.infer<typeof AdminListingQuery>;

export const AdminListingRow = z.object({
  id: z.string().uuid(),
  vehicleId: z.string().uuid(),
  title: z.string(),
  registrationDisplay: z.string(),
  summary: z.string(),
  priceLabel: z.string().nullable(),
  status: ListingStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  dealer: z.object({ id: z.string().uuid(), name: z.string(), slug: z.string() }),
  location: z.string().nullable(),
  submittedAt: z.string().nullable(),
  submittedLabel: z.string().nullable(),
  waitingLabel: z.string().nullable(),
  resubmission: z.boolean(),
});
export type AdminListingRow = z.infer<typeof AdminListingRow>;

/**
 * A page of listings in one status. The review queue (PENDING_REVIEW, the
 * default) is oldest submission first, because that is the order it is worked
 * in; every other status is most recently changed first. `counts` is per status
 * across the platform, unaffected by the search.
 */
export const AdminListingsResponse = z.object({
  status: ListingStatus,
  data: z.array(AdminListingRow),
  page: CursorPage,
  counts: z.record(z.string(), z.number().int()),
});
export type AdminListingsResponse = z.infer<typeof AdminListingsResponse>;
