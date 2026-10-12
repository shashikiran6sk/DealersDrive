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

export const DEALER_VERIFICATION_TRANSITIONS: Record<
  DealerVerificationStatus,
  readonly DealerVerificationStatus[]
> = {
  NOT_VERIFIED: ['PENDING', 'IN_REVIEW'],
  PENDING: ['IN_REVIEW', 'REJECTED'],
  IN_REVIEW: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['REVOKED'],
  REJECTED: ['PENDING', 'IN_REVIEW'],
  REVOKED: ['PENDING', 'IN_REVIEW'],
};

const EvidenceReference = z
  .string()
  .trim()
  .min(20, 'Describe the check and its evidence reference.')
  .max(2000);
export const DealerVerificationAssessment = z
  .object({
    representativeIdentity: EvidenceReference,
    representativeAuthority: EvidenceReference,
    businessExistence: EvidenceReference,
    contactValidation: EvidenceReference,
    businessType: z.enum(['REGISTERED_VEHICLE_DEALER', 'INTERMEDIARY_REVIEWED']),
    classificationEvidence: EvidenceReference,
    regulatoryOutcome: z.enum(['CHECKED_VALID', 'NOT_APPLICABLE_REVIEWED']),
    regulatoryEvidence: EvidenceReference,
    gstOutcome: z.enum(['CHECKED_VALID', 'NOT_REQUIRED_REVIEWED']),
    gstEvidence: EvidenceReference,
  })
  .strict();
export type DealerVerificationAssessment = z.infer<typeof DealerVerificationAssessment>;

export const DealerVerificationDecisionInput = z
  .object({
    expectedVersion: z.number().int().min(0),
    status: DealerVerificationStatus.exclude(['NOT_VERIFIED']),
    reason: z.string().trim().min(10).max(2000).optional(),
    assessment: DealerVerificationAssessment.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === 'VERIFIED' && !value.assessment)
      ctx.addIssue({
        code: 'custom',
        path: ['assessment'],
        message: 'Record all performed verification checks.',
      });
    if ((value.status === 'REJECTED' || value.status === 'REVOKED') && !value.reason)
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Record the decision reason.' });
    if (value.status !== 'VERIFIED' && value.assessment)
      ctx.addIssue({
        code: 'custom',
        path: ['assessment'],
        message: 'Assessment belongs to a verified decision.',
      });
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
      assessment: DealerVerificationAssessment.nullable(),
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
