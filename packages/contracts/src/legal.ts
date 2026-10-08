import { z } from 'zod';

import { Uuid } from './common.js';
import { LEGAL_NOTICES_V1, LEGAL_DOCUMENTS_V1 } from './legal-documents/v1.js';

export { LEGAL_DOCUMENTS_V1 } from './legal-documents/v1.js';

export const LEGAL_RELEASE_APPROVED = false;
export const LegalDocumentId = z.enum([
  'terms',
  'privacy',
  'dealer',
  'listing',
  'grievance',
  'rights',
]);
export type LegalDocumentId = z.infer<typeof LegalDocumentId>;

export const LEGAL_DOCUMENTS = LEGAL_DOCUMENTS_V1;
export const LEGAL_VERSION = '1.0-draft.1';
export const ENQUIRY_NOTICE_VERSION = '1.0-draft.1';
export const ENQUIRY_NOTICE = LEGAL_NOTICES_V1.enquiry.text;
export const LISTING_CERTIFICATION = LEGAL_NOTICES_V1.certification.text;

export const AgreementAcceptance = z
  .object({
    version: z.string().min(1).max(40),
    accepted: z.literal(true),
    privacyAcknowledged: z.literal(true),
  })
  .strict();
export type AgreementAcceptance = z.infer<typeof AgreementAcceptance>;

export const DealerAcceptanceInput = AgreementAcceptance.extend({
  authorityConfirmed: z.literal(true),
}).strict();
export type DealerAcceptanceInput = z.infer<typeof DealerAcceptanceInput>;

export const TermsAcceptanceInput = AgreementAcceptance;
export type TermsAcceptanceInput = z.infer<typeof TermsAcceptanceInput>;

export const SubmitVehicleInput = z
  .object({
    certification: z
      .object({ version: z.string().min(1).max(40), certified: z.literal(true) })
      .strict()
      .optional(),
  })
  .strict();
export type SubmitVehicleInput = z.infer<typeof SubmitVehicleInput>;

export const DealerSubmitInput = z.object({ agreement: DealerAcceptanceInput.optional() }).strict();
export type DealerSubmitInput = z.infer<typeof DealerSubmitInput>;

export const EnquirySharingPermission = z
  .object({
    version: z.string().min(1).max(40),
    granted: z.literal(true),
  })
  .strict();
export type EnquirySharingPermission = z.infer<typeof EnquirySharingPermission>;

export const LegalReceipt = z.object({
  id: Uuid,
  documentId: z.string(),
  version: z.string(),
  digest: z.string(),
  action: z.enum(['ACCEPT', 'ACKNOWLEDGE', 'GRANT', 'WITHDRAW', 'CERTIFY']),
  subjectType: z.enum(['USER', 'DEALER', 'LISTING', 'ENQUIRY']),
  subjectId: Uuid,
  context: z.string(),
  createdAt: z.string(),
});
export const LegalStatus = z.object({
  enabled: z.boolean(),
  version: z.string(),
  termsRequired: z.boolean(),
  dealerRequired: z.boolean(),
  mayBindDealer: z.boolean(),
});
export type LegalStatus = z.infer<typeof LegalStatus>;
export const LegalHistory = z.object({ data: z.array(LegalReceipt) });
export type LegalHistory = z.infer<typeof LegalHistory>;

export const LegalEnquiryParam = z.object({ id: Uuid }).strict();

export const LegalEvidenceQuery = z
  .object({ subjectId: Uuid, subjectType: z.enum(['USER', 'DEALER', 'LISTING', 'ENQUIRY']) })
  .strict();
export type LegalEvidenceQuery = z.infer<typeof LegalEvidenceQuery>;

export const LEGAL_DOCUMENT_ARCHIVE = [LEGAL_DOCUMENTS_V1] as const;
export function legalDocumentSnapshot(id: LegalDocumentId, version: string) {
  return LEGAL_DOCUMENT_ARCHIVE.find((documents) => documents[id].version === version)?.[id];
}

export const LEGAL_NOTICE_ARCHIVE = [LEGAL_NOTICES_V1] as const;
export function legalNoticeSnapshot(id: 'enquiry' | 'certification', version: string) {
  return LEGAL_NOTICE_ARCHIVE.find((notices) => notices[id].version === version)?.[id];
}

export function legalReleaseReady(): boolean {
  return (
    LEGAL_RELEASE_APPROVED &&
    Object.values(LEGAL_DOCUMENTS).every(
      (document) =>
        document.reviewed && document.effectiveDate !== null && !document.version.includes('draft'),
    )
  );
}
