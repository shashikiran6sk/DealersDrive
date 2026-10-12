import { z } from 'zod';

import { Uuid, isPlainFileName } from './common.js';

/**
 * Dealer portfolio photographs (#299): images of the dealership a dealer
 * chooses to show on their own public page. They are not identity evidence and
 * are not required for anything. Every new or replacement image is private and
 * pending until an admin approves it; only approved images are served.
 *
 * Directory cards keep the one standard image (#289) — a portfolio photograph
 * appears only on the dealership's own page.
 */
export const PortfolioPhotoStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'REMOVED']);
export type PortfolioPhotoStatus = z.infer<typeof PortfolioPhotoStatus>;

export const PORTFOLIO_PHOTO_STATUS_LABELS: Record<PortfolioPhotoStatus, string> = {
  PENDING: 'Awaiting review — not public yet',
  APPROVED: 'Approved — shown on your page',
  REJECTED: 'Rejected',
  REMOVED: 'Removed',
};

export const PORTFOLIO_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PORTFOLIO_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
/** Approved and pending together; a replacement does not count against it. */
export const PORTFOLIO_PHOTO_LIMIT = 8;

export const PortfolioPhotoPresignInput = z
  .object({
    fileName: z.string().trim().min(1).max(160).refine(isPlainFileName, 'Use a plain file name.'),
    mimeType: z.enum(PORTFOLIO_PHOTO_MIME_TYPES),
    bytes: z
      .number()
      .int()
      .min(1)
      .max(PORTFOLIO_PHOTO_MAX_BYTES, 'Keep the photograph under 10 MB.'),
    /** The approved photograph this one is meant to replace, if any. */
    replacesId: Uuid.optional(),
  })
  .strict();
export type PortfolioPhotoPresignInput = z.infer<typeof PortfolioPhotoPresignInput>;

export const PortfolioPhotoCommitInput = z
  .object({
    mediaId: Uuid,
    replacesId: Uuid.optional(),
    caption: z.string().trim().max(120).optional(),
  })
  .strict();
export type PortfolioPhotoCommitInput = z.infer<typeof PortfolioPhotoCommitInput>;

export const PortfolioPhotoPresignResponse = z.object({
  mediaId: Uuid,
  uploadUrl: z.string(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  expiresInSeconds: z.number().int(),
});
export type PortfolioPhotoPresignResponse = z.infer<typeof PortfolioPhotoPresignResponse>;

export const DealerPortfolioPhoto = z.object({
  id: Uuid,
  status: PortfolioPhotoStatus,
  statusLabel: z.string(),
  /** Short-lived signed read of the private original, for the owner and reviewers only. */
  previewUrl: z.string().nullable(),
  caption: z.string().nullable(),
  replacesId: Uuid.nullable(),
  position: z.number().int(),
  rejectionReason: z.string().nullable(),
  submittedAt: z.string(),
  reviewedAt: z.string().nullable(),
});
export type DealerPortfolioPhoto = z.infer<typeof DealerPortfolioPhoto>;

export const DealerPortfolioResponse = z.object({
  data: z.array(DealerPortfolioPhoto),
  limit: z.number().int(),
  canAdd: z.boolean(),
});
export type DealerPortfolioResponse = z.infer<typeof DealerPortfolioResponse>;

export const PortfolioPhotoParam = z.object({ id: Uuid }).strict();
export type PortfolioPhotoParam = z.infer<typeof PortfolioPhotoParam>;

export const PortfolioModerationQuery = z
  .object({ status: z.enum(['PENDING', 'REJECTED']).default('PENDING') })
  .strict();
export type PortfolioModerationQuery = z.infer<typeof PortfolioModerationQuery>;

export const AdminPortfolioPhoto = DealerPortfolioPhoto.extend({
  dealerId: Uuid,
  dealerName: z.string(),
  dealerSlug: z.string(),
  /** The approved image a pending replacement would take the place of. */
  replacesPreviewUrl: z.string().nullable(),
});
export type AdminPortfolioPhoto = z.infer<typeof AdminPortfolioPhoto>;

export const AdminPortfolioQueue = z.object({ data: z.array(AdminPortfolioPhoto) });
export type AdminPortfolioQueue = z.infer<typeof AdminPortfolioQueue>;

export const PortfolioDecisionResponse = z.object({
  id: Uuid,
  status: PortfolioPhotoStatus,
  /** The photograph an approved replacement took off the page, if any. */
  replacedId: Uuid.nullable(),
});
export type PortfolioDecisionResponse = z.infer<typeof PortfolioDecisionResponse>;

/** What the public dealership page shows: approved photographs only. */
export const PublicPortfolioPhoto = z.object({
  url: z.string(),
  caption: z.string().nullable(),
});
export type PublicPortfolioPhoto = z.infer<typeof PublicPortfolioPhoto>;
