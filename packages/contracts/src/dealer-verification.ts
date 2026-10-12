import { z } from 'zod';

export const DealerVerificationStatus = z.enum([
  'NOT_VERIFIED',
  'PENDING',
  'IN_REVIEW',
  'VERIFIED',
  'REJECTED',
  'REVOKED',
]);
export type DealerVerificationStatus = z.infer<typeof DealerVerificationStatus>;

export const DEALER_VERIFICATION_LABELS: Record<DealerVerificationStatus, string> = {
  NOT_VERIFIED: 'Not verified',
  PENDING: 'Pending verification',
  IN_REVIEW: 'Verification in review',
  VERIFIED: 'Dealer Verified',
  REJECTED: 'Verification rejected',
  REVOKED: 'Verification revoked',
};

/**
 * A reviewer may grant Dealer Verified directly (owner decision, 2026-10-12):
 * "Pending" and "In review" are optional labels for a review that takes time,
 * not steps every decision must pass through. What the badge rests on — an
 * ACTIVE dealership, a proved phone and email, both document categories
 * verified and on file — is checked by the API on every VERIFIED decision,
 * whichever status it comes from.
 */
export const DEALER_VERIFICATION_TRANSITIONS: Record<
  DealerVerificationStatus,
  readonly DealerVerificationStatus[]
> = {
  NOT_VERIFIED: ['PENDING', 'IN_REVIEW', 'VERIFIED'],
  PENDING: ['IN_REVIEW', 'VERIFIED', 'REJECTED'],
  IN_REVIEW: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['REVOKED'],
  REJECTED: ['PENDING', 'IN_REVIEW', 'VERIFIED'],
  REVOKED: ['PENDING', 'IN_REVIEW', 'VERIFIED'],
};

/**
 * A verification decision is a status and, for a rejection or revocation, the
 * reason. What a Dealer Verified badge rests on is checked by the API, not
 * typed by the reviewer: an approved dealership, verified contact details and
 * both document categories reviewed and on file (#299).
 */
export const DealerVerificationDecisionInput = z
  .object({
    expectedVersion: z.number().int().min(0),
    status: DealerVerificationStatus.exclude(['NOT_VERIFIED']),
    reason: z.string().trim().min(10).max(2000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.status === 'REJECTED' || value.status === 'REVOKED') && !value.reason)
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Record the decision reason.' });
  });
export type DealerVerificationDecisionInput = z.infer<typeof DealerVerificationDecisionInput>;

export const DealerVerificationReview = z.object({
  dealerId: z.string().uuid(),
  status: DealerVerificationStatus,
  statusLabel: z.string(),
  version: z.number().int().min(0),
  verifiedAt: z.string().nullable(),
  reviewerId: z.string().uuid().nullable(),
  transitions: z.array(DealerVerificationStatus),
  history: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      actorId: z.string().nullable(),
      from: DealerVerificationStatus,
      to: DealerVerificationStatus,
      reason: z.string().nullable(),
    }),
  ),
});
export type DealerVerificationReview = z.infer<typeof DealerVerificationReview>;

export function isDealerVerified(dealer: {
  status?: string;
  verificationStatus?: string;
}): boolean {
  return dealer.status === 'ACTIVE' && dealer.verificationStatus === 'VERIFIED';
}
