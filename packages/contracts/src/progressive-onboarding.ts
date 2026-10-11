import { z } from 'zod';
import { OnboardingInput } from './auth.js';
import { DealerDocType } from './enums.js';

export const PROGRESSIVE_DECLARATION_VERSION = 'dealer-registration-draft-2026-10-11';
export const PROGRESSIVE_DECLARATION =
  'I am authorized to represent this dealership and consent to Dealers-Drive saving this application and securely reviewing the information and documents I choose to submit.';
export const ProgressiveRegistrationInput = OnboardingInput.pick({
  fullName: true,
  phone: true,
  legalName: true,
  city: true,
  district: true,
  state: true,
})
  .extend({
    declaration: z.literal(true, { error: 'Confirm authorization and registration consent.' }),
  })
  .strict();
export type ProgressiveRegistrationInput = z.infer<typeof ProgressiveRegistrationInput>;
export const ProgressiveAssistedRegistrationInput = ProgressiveRegistrationInput.omit({
  fullName: true,
  phone: true,
})
  .extend({
    phoneTicket: z.string().trim().min(1).max(2048),
    contactName: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email().max(160),
  })
  .strict();
export type ProgressiveAssistedRegistrationInput = z.infer<
  typeof ProgressiveAssistedRegistrationInput
>;
const Reference = z.string().trim().min(20).max(1000);
export const ProgressiveVerificationPlan = z
  .object({
    classification: z.enum(['REGISTERED_VEHICLE_DEALER', 'INTERMEDIARY_REVIEWED']),
    classificationReference: Reference,
    requiredDocuments: z
      .array(DealerDocType)
      .min(1)
      .max(3)
      .refine((a) => new Set(a).size === a.length, 'Each required document must be distinct.'),
    gstRequirement: z.enum(['REQUIRED', 'NOT_REQUIRED_REVIEWED']),
    gstReference: Reference,
    representativeIdentityReference: Reference,
    representativeAuthorityReference: Reference,
    businessExistenceReference: Reference,
    regulatoryOutcome: z.enum(['CHECKED_VALID', 'NOT_APPLICABLE_REVIEWED']),
    regulatoryReference: Reference,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.classification === 'REGISTERED_VEHICLE_DEALER' && v.regulatoryOutcome !== 'CHECKED_VALID')
      ctx.addIssue({
        code: 'custom',
        path: ['regulatoryOutcome'],
        message: 'Record the applicable dealer authorization check.',
      });
    if (v.gstRequirement === 'REQUIRED' && !v.requiredDocuments.includes('GST_CERTIFICATE'))
      ctx.addIssue({
        code: 'custom',
        path: ['requiredDocuments'],
        message: 'Applicable GST registration needs its certificate.',
      });
  });
export type ProgressiveVerificationPlan = z.infer<typeof ProgressiveVerificationPlan>;
export const ProgressivePlanInput = z
  .object({ expectedVersion: z.number().int().min(0), plan: ProgressiveVerificationPlan })
  .strict();
export type ProgressivePlanInput = z.infer<typeof ProgressivePlanInput>;
export const ProgressiveState = z.object({
  dealerId: z.string().uuid(),
  stage: z.enum(['REGISTER', 'VERIFY', 'ACTIVATE']),
  registeredAt: z.string(),
  consentVersion: z.string(),
  version: z.number().int().min(0),
  classificationReviewed: z.boolean(),
  requiredDocuments: z.array(DealerDocType),
  canSubmit: z.boolean(),
  canActivate: z.boolean(),
});
export type ProgressiveState = z.infer<typeof ProgressiveState>;
