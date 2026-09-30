import { z } from 'zod';

import { CursorPage } from './common.js';
import { IMAGE_MAX_BYTES, IMAGE_MIME_TYPES } from './dealer.js';
import { ListingStatus, StatusTone } from './enums.js';
import { ReactivationRequestStatus } from './listing.js';

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
  /** Images attached to the vehicle (**R45**), so the queue shows readiness. */
  imageCount: z.number().int(),
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
  /** Reactivation requests waiting for a decision, for the queue's tab. */
  reactivationPending: z.number().int(),
});
export type AdminListingsResponse = z.infer<typeof AdminListingsResponse>;

// ─────────── reactivation requests ───────────────────────────────────────

/**
 * A dealer's request to put a RESERVED or WITHDRAWN car back on sale. The
 * dealer cannot make that move; an admin approves (the listing goes ACTIVE) or
 * rejects (it stays where it is). Pending requests are worked oldest first;
 * decided ones are listed most recently decided first.
 */
export const AdminReactivationQuery = z
  .object({
    status: ReactivationRequestStatus.optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type AdminReactivationQuery = z.infer<typeof AdminReactivationQuery>;

export const AdminReactivationRow = z.object({
  id: z.string().uuid(),
  status: ReactivationRequestStatus,
  statusLabel: z.string(),
  statusTone: StatusTone,
  fromStatus: ListingStatus,
  fromStatusLabel: z.string(),
  toStatus: ListingStatus,
  toStatusLabel: z.string(),
  /** The dealer's own words, if they gave any. */
  reason: z.string().nullable(),
  requestedAt: z.string(),
  requestedLabel: z.string(),
  reviewedAt: z.string().nullable(),
  adminNote: z.string().nullable(),
  listing: z.object({
    id: z.string().uuid(),
    vehicleId: z.string().uuid(),
    title: z.string(),
    registrationDisplay: z.string(),
    status: ListingStatus,
    statusLabel: z.string(),
    statusTone: StatusTone,
    slug: z.string().nullable(),
  }),
  dealer: z.object({ id: z.string().uuid(), name: z.string(), slug: z.string() }),
  /** Whether the listing is still in the state the request was filed from. */
  current: z.boolean(),
});
export type AdminReactivationRow = z.infer<typeof AdminReactivationRow>;

export const AdminReactivationsResponse = z.object({
  status: ReactivationRequestStatus,
  data: z.array(AdminReactivationRow),
  page: CursorPage,
  counts: z.record(z.string(), z.number().int()),
});
export type AdminReactivationsResponse = z.infer<typeof AdminReactivationsResponse>;

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
/**
 * The most images one vehicle may carry (**R45**) — StudioCar's batch size.
 * A ceiling, not a requirement: the minimum is the platform config key
 * `listing.minPhotos`, handed to the console in `AdminListingDetail.images`.
 */
export const VEHICLE_IMAGE_MAX = 20;

/**
 * An admin's request to upload one processed image to a listing's vehicle
 * (**R45**). The client names the file, never the path: the storage key is
 * derived by the server from the vehicle id and a server-generated media id.
 */
export const VehicleImagePresignInput = z
  .object({
    fileName: z.string().trim().min(1).max(160),
    mimeType: z.enum(IMAGE_MIME_TYPES),
    bytes: z.number().int().min(1).max(IMAGE_MAX_BYTES),
    width: z.number().int().min(1).max(20000).optional(),
    height: z.number().int().min(1).max(20000).optional(),
  })
  .strict();
export type VehicleImagePresignInput = z.infer<typeof VehicleImagePresignInput>;

export const ListingImageParam = z
  .object({ id: z.string().uuid(), mediaId: z.string().uuid() })
  .strict();
export type ListingImageParam = z.infer<typeof ListingImageParam>;

/**
 * The gallery order an admin wants (**F035** as reinterpreted by **R45**):
 * every attached image's media id, exactly once, first to last. Anything
 * other than a permutation of what is attached is refused by the API.
 */
export const ReorderImagesInput = z
  .object({
    mediaIds: z
      .array(z.string().uuid())
      .min(1)
      .max(VEHICLE_IMAGE_MAX)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Each image may appear only once.',
      }),
  })
  .strict();
export type ReorderImagesInput = z.infer<typeof ReorderImagesInput>;

/**
 * One image as a moderator sees it. `url` is a short-lived signed read URL —
 * the image is not public until the listing is.
 */
export const AdminVehicleImage = z.object({
  mediaId: z.string().uuid(),
  position: z.number().int(),
  isPrimary: z.boolean(),
  url: z.string(),
  fileName: z.string().nullable(),
  mimeType: z.string(),
  bytes: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  uploadedAt: z.string(),
});
export type AdminVehicleImage = z.infer<typeof AdminVehicleImage>;

export const AdminVehicleImages = z.object({
  items: z.array(AdminVehicleImage),
  min: z.number().int(),
  max: z.number().int(),
  canEdit: z.boolean(),
});
export type AdminVehicleImages = z.infer<typeof AdminVehicleImages>;

/**
 * What stands between a listing in review and the marketplace (**R45**,
 * **R47**). The API computes the list once, from the same rules the approve
 * route enforces, so the review screen can never offer an approval the API
 * would refuse.
 */
export const ApprovalBlockerCode = z.enum([
  'DEALER_NOT_ACTIVE',
  'VEHICLE_INCOMPLETE',
  'CHECKS_INCOMPLETE',
  'TOO_FEW_IMAGES',
  'NO_PRIMARY_IMAGE',
]);
export type ApprovalBlockerCode = z.infer<typeof ApprovalBlockerCode>;

export const ApprovalBlocker = z.object({
  code: ApprovalBlockerCode,
  message: z.string(),
});
export type ApprovalBlocker = z.infer<typeof ApprovalBlocker>;

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
  images: AdminVehicleImages,
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
  /** Empty when the listing may be approved; always empty out of review. */
  blockers: z.array(ApprovalBlocker),
  actions: z.object({
    canVerify: z.boolean(),
    canRequestChanges: z.boolean(),
    canReject: z.boolean(),
    canApprove: z.boolean(),
  }),
});
export type AdminListingDetail = z.infer<typeof AdminListingDetail>;
