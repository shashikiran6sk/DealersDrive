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
/**
 * Where Dealers-Drive's own photography of a car has got to (**R45**), set by
 * the operations team. There is no StudioCar integration behind it. Mirrors the
 * Prisma enum of the same name.
 */
export const PhotographyStatus = z.enum([
  'NOT_STARTED',
  'SCHEDULED',
  'PHOTOGRAPHED',
  'PROCESSING',
  'READY',
]);
export type PhotographyStatus = z.infer<typeof PhotographyStatus>;

export const PHOTOGRAPHY_STATUS_LABELS: Record<PhotographyStatus, string> = {
  NOT_STARTED: 'Not photographed',
  SCHEDULED: 'Shoot scheduled',
  PHOTOGRAPHED: 'Photographed',
  PROCESSING: 'Processing in StudioCar',
  READY: 'Images ready',
};

export const PHOTOGRAPHY_STATUS_TONES: Record<PhotographyStatus, StatusTone> = {
  NOT_STARTED: 'neutral',
  SCHEDULED: 'warn',
  PHOTOGRAPHED: 'warn',
  PROCESSING: 'warn',
  READY: 'ok',
};

export const PhotographyDto = z.object({
  status: PhotographyStatus,
  label: z.string(),
  tone: StatusTone,
});
export type PhotographyDto = z.infer<typeof PhotographyDto>;

export const SetPhotographyInput = z
  .object({
    status: PhotographyStatus,
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strict();
export type SetPhotographyInput = z.infer<typeof SetPhotographyInput>;

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
  photography: PhotographyDto,
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

// ─────────── review (F070) ─────────────────────────────────────────────────

/**
 * What a moderator verifies before a listing can go live. Mirrors the Prisma
 * enum of the same name. Every key must be checked for approval; the set is
 * cleared when the dealer resubmits.
 */
export const ListingCheckKey = z.enum([
  'REGISTRATION',
  'MAKE_MODEL',
  'VARIANT',
  'YEAR',
  'ODOMETER',
  'OWNERSHIP',
  'PRICING',
]);
export type ListingCheckKey = z.infer<typeof ListingCheckKey>;

export const LISTING_CHECK_LABELS: Record<ListingCheckKey, { label: string; hint: string }> = {
  REGISTRATION: {
    label: 'Registration checked',
    hint: 'The plate on the car matches the number entered and the RC.',
  },
  MAKE_MODEL: { label: 'Make and model checked', hint: 'The car is the make and model entered.' },
  VARIANT: {
    label: 'Variant checked',
    hint: 'The trim on the car matches, or none was entered and none is claimed.',
  },
  YEAR: {
    label: 'Year checked',
    hint: 'Manufacturing and registration years match the RC.',
  },
  ODOMETER: {
    label: 'Odometer checked',
    hint: 'The reading on the dashboard matches the kilometres entered.',
  },
  OWNERSHIP: { label: 'Ownership checked', hint: 'The number of owners matches the RC.' },
  PRICING: {
    label: 'Pricing checked',
    hint: 'The price is plausible for this car, with no phone number or contact in the text.',
  },
};

export const ListingCheckParam = z.object({ id: z.string().uuid(), key: ListingCheckKey }).strict();
export type ListingCheckParam = z.infer<typeof ListingCheckParam>;

export const SetListingCheckInput = z.object({ checked: z.boolean() }).strict();
export type SetListingCheckInput = z.infer<typeof SetListingCheckInput>;

const Row = z.object({ label: z.string(), value: z.string().nullable() });

/**
 * The full review screen in one response: the dealer-entered data in the
 * sections a moderator verifies it in, the checklist, the listing's history and
 * which decisions the current state allows — so the console renders the state
 * machine rather than re-deriving it.
 */
export const AdminListingDetail = z.object({
  listing: AdminListingRow.extend({
    reason: z.string().nullable(),
    submissionCount: z.number().int(),
    publishedAt: z.string().nullable(),
  }),
  dealer: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    status: z.string(),
    statusLabel: z.string(),
    statusTone: StatusTone,
    location: z.string().nullable(),
    phoneDisplay: z.string().nullable(),
  }),
  sections: z.array(z.object({ key: z.string(), title: z.string(), rows: z.array(Row) })),
  description: z.string().nullable(),
  issues: z.array(z.object({ field: z.string(), message: z.string() })),
  photography: PhotographyDto.extend({
    note: z.string().nullable(),
    updatedAt: z.string().nullable(),
    canUpdate: z.boolean(),
  }),
  checks: z.array(
    z.object({
      key: ListingCheckKey,
      label: z.string(),
      hint: z.string(),
      checked: z.boolean(),
      checkedAt: z.string().nullable(),
    }),
  ),
  history: z.array(
    z.object({
      action: z.string(),
      label: z.string(),
      actor: z.string(),
      reason: z.string().nullable(),
      at: z.string(),
      atLabel: z.string(),
    }),
  ),
  actions: z.object({
    canVerify: z.boolean(),
    canRequestChanges: z.boolean(),
    canReject: z.boolean(),
    canApprove: z.boolean(),
  }),
});
export type AdminListingDetail = z.infer<typeof AdminListingDetail>;
