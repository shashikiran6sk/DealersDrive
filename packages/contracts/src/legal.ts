import { AgreementAcceptance } from './legal-inputs.js';
import { z } from 'zod';

import { Uuid } from './common.js';
import { LEGAL_NOTICES_V1, LEGAL_DOCUMENTS_V1 } from './legal-documents/v1.js';
import { LEGAL_PRIVACY_V3 } from './legal-documents/v3.js';
import { LEGAL_DOCUMENTS_V2, LEGAL_NOTICES_V2 } from './legal-documents/v2.js';

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

export const LEGAL_DOCUMENTS = { terms: LEGAL_DOCUMENTS_V2.terms, privacy: LEGAL_PRIVACY_V3 };
export const PRIVACY_VERSION = LEGAL_DOCUMENTS.privacy.version;
export const LEGAL_VERSION = LEGAL_DOCUMENTS.terms.version;
export const ENQUIRY_NOTICE_VERSION = LEGAL_NOTICES_V2.enquiry.version;
export const CERTIFICATION_NOTICE_VERSION = LEGAL_NOTICES_V2.certification.version;
export const ENQUIRY_NOTICE = LEGAL_NOTICES_V2.enquiry.text;
export const LISTING_CERTIFICATION = LEGAL_NOTICES_V2.certification.text;

export { AgreementAcceptance } from './legal-inputs.js';
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

export const LegalEnquiryParam = z.object({ id: Uuid }).strict();

export const LegalEvidenceQuery = z
  .object({ subjectId: Uuid, subjectType: z.enum(['USER', 'DEALER', 'LISTING', 'ENQUIRY']) })
  .strict();
export type LegalEvidenceQuery = z.infer<typeof LegalEvidenceQuery>;

export const LEGAL_DOCUMENT_ARCHIVE = [
  LEGAL_DOCUMENTS_V1,
  LEGAL_DOCUMENTS_V2,
  { privacy: LEGAL_PRIVACY_V3 },
] as const;
export function legalDocumentSnapshot(id: LegalDocumentId, version: string) {
  const snapshots = [
    ...Object.values(LEGAL_DOCUMENTS_V1),
    ...Object.values(LEGAL_DOCUMENTS_V2),
    LEGAL_PRIVACY_V3,
  ];
  return snapshots.find((document) => document.id === id && document.version === version);
}

export const LEGAL_NOTICE_ARCHIVE = [LEGAL_NOTICES_V1, LEGAL_NOTICES_V2] as const;
export function legalNoticeSnapshot(id: 'enquiry' | 'certification', version: string) {
  return LEGAL_NOTICE_ARCHIVE.find((notices) => notices[id].version === version)?.[id];
}

export function legalReleaseReady(): boolean {
  return (
    LEGAL_RELEASE_APPROVED &&
    !ENQUIRY_NOTICE_VERSION.includes('draft') &&
    !CERTIFICATION_NOTICE_VERSION.includes('draft') &&
    Object.values(LEGAL_DOCUMENTS).every(
      (document) =>
        document.reviewed &&
        document.effectiveDate !== null &&
        Number.isFinite(Date.parse(document.effectiveDate)) &&
        Date.parse(document.effectiveDate) <= Date.now() &&
        !document.version.includes('draft'),
    )
  );
}

export const SharingStatusQuery = z
  .object({ listingSlug: z.string().trim().min(1).max(200) })
  .strict();
export const SharingStatus = z.object({
  required: z.boolean(),
  recipientId: Uuid,
  dealerName: z.string(),
});
export const SharingGrantParam = z.object({ id: Uuid }).strict();
export const SharingPermissions = z.object({
  data: z.array(
    z.object({
      id: Uuid,
      dealerName: z.string(),
      grantedAt: z.string(),
      noticeVersion: z.string(),
    }),
  ),
});

export function currentLegalDocument(id: LegalDocumentId) {
  return id === 'terms' || id === 'privacy' ? LEGAL_DOCUMENTS[id] : undefined;
}
