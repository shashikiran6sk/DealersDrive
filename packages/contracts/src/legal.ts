import { z } from 'zod';
import { legalV1Ready, LEGAL_V1_PUBLICATION } from './legal-documents/v1.js';

export * from './legal-documents/v1.js';

export const LEGAL_TERMS_VERSION = 'terms-v1.0';
export const LEGAL_PRIVACY_VERSION = 'privacy-v1.0';
export const LEGAL_REQUIRED = 'LEGAL_ACCEPTANCE_REQUIRED';
export const LEGAL_CHECKBOX_TEXT = 'I agree to the Terms & Conditions and Privacy Policy.';

export const LegalScope = z.enum(['CUSTOMER', 'DEALER']);
export type LegalScope = z.infer<typeof LegalScope>;
export const LegalStatusQuery = z.object({ scope: LegalScope }).strict();
export const LegalAcceptInput = z.object({ scope: LegalScope, accepted: z.literal(true) }).strict();
export type LegalAcceptInput = z.infer<typeof LegalAcceptInput>;
export const DealerLegalSubmitInput = z.object({ accepted: z.literal(true).optional() }).strict();
export type DealerLegalSubmitInput = z.infer<typeof DealerLegalSubmitInput>;
export const LegalStatus = z
  .object({
    enabled: z.boolean(),
    accepted: z.boolean(),
    canAccept: z.boolean(),
    termsVersion: z.literal(LEGAL_TERMS_VERSION),
    privacyVersion: z.literal(LEGAL_PRIVACY_VERSION),
  })
  .strict();
export type LegalStatus = z.infer<typeof LegalStatus>;

export function legalV1Enabled(
  production: boolean,
  preview: boolean,
  publication = LEGAL_V1_PUBLICATION,
): boolean {
  return production ? legalV1Ready(publication) : preview;
}
