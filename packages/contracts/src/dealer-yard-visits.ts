import { z } from 'zod';

import { Uuid, isPlainFileName } from './common.js';
import { PortfolioPhotoPresignResponse } from './dealer-portfolio.js';

/**
 * Internal yard visits (#299): when Dealers-Drive staff visit a dealership,
 * what they found and the photographs they took. Private operational evidence
 * — never served publicly, never required, and never a route to Dealer
 * Verified. A dealership that trades without a physical yard is recorded as
 * such and is not penalised for it.
 */
export const YardVisitOutcome = z.enum(['YARD_CONFIRMED', 'NO_PHYSICAL_YARD', 'NOT_ACCESSIBLE']);
export type YardVisitOutcome = z.infer<typeof YardVisitOutcome>;

export const YARD_VISIT_OUTCOME_LABELS: Record<YardVisitOutcome, string> = {
  YARD_CONFIRMED: 'Yard seen at the address',
  NO_PHYSICAL_YARD: 'Trades without a physical yard',
  NOT_ACCESSIBLE: 'Could not be visited',
};

export const YARD_VISIT_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const YARD_VISIT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const YARD_VISIT_PHOTO_LIMIT = 12;

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.');

export const CreateYardVisitInput = z
  .object({
    visitedOn: IsoDate.refine(
      (value) => new Date(`${value}T00:00:00Z`).getTime() <= Date.now(),
      'A visit cannot be in the future.',
    ),
    outcome: YardVisitOutcome,
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();
export type CreateYardVisitInput = z.infer<typeof CreateYardVisitInput>;

export const YardVisitParam = z.object({ id: Uuid, visitId: Uuid }).strict();
export type YardVisitParam = z.infer<typeof YardVisitParam>;

export const YardVisitPhotoPresignInput = z
  .object({
    fileName: z.string().trim().min(1).max(160).refine(isPlainFileName, 'Use a plain file name.'),
    mimeType: z.enum(YARD_VISIT_PHOTO_MIME_TYPES),
    bytes: z.number().int().min(1).max(YARD_VISIT_PHOTO_MAX_BYTES),
  })
  .strict();
export type YardVisitPhotoPresignInput = z.infer<typeof YardVisitPhotoPresignInput>;

/** The same direct-to-storage upload the portfolio uses, into a private key. */
export const YardVisitPhotoPresignResponse = PortfolioPhotoPresignResponse;
export type YardVisitPhotoPresignResponse = PortfolioPhotoPresignResponse;

export const YardVisitPhotoCommitInput = z.object({ mediaId: Uuid }).strict();
export type YardVisitPhotoCommitInput = z.infer<typeof YardVisitPhotoCommitInput>;

export const YardVisitDto = z.object({
  id: Uuid,
  visitedOn: z.string(),
  outcome: YardVisitOutcome,
  outcomeLabel: z.string(),
  notes: z.string().nullable(),
  recordedBy: z.string().nullable(),
  recordedAt: z.string(),
  photos: z.array(z.object({ mediaId: Uuid, url: z.string(), expiresAt: z.string() })),
});
export type YardVisitDto = z.infer<typeof YardVisitDto>;

export const YardVisitsResponse = z.object({ data: z.array(YardVisitDto) });
export type YardVisitsResponse = z.infer<typeof YardVisitsResponse>;
