import { z } from 'zod';
import { Uuid } from './common.js';
export { AgreementAcceptance as TermsAcceptanceInput } from './legal-inputs.js';

export const LegalReceipt = z.object({
  id: Uuid,
  documentId: z.string(),
  version: z.string(),
  digest: z.string(),
  action: z.enum(['ACCEPT', 'ACKNOWLEDGE', 'GRANT', 'WITHDRAW', 'CERTIFY', 'DISCLOSE']),
  subjectType: z.enum(['USER', 'DEALER', 'LISTING', 'ENQUIRY']),
  subjectId: Uuid,
  context: z.string(),
  createdAt: z.string(),
});
export const LegalStatus = z.object({
  enabled: z.boolean(),
  version: z.string(),
  termsRequired: z.boolean(),
  privacyRequired: z.boolean(),
  dealerRequired: z.boolean(),
  mayBindDealer: z.boolean(),
  dealerSubmissionRequired: z.boolean(),
});
export type LegalStatus = z.infer<typeof LegalStatus>;
export const LegalHistory = z.object({ data: z.array(LegalReceipt) });
export type LegalHistory = z.infer<typeof LegalHistory>;
