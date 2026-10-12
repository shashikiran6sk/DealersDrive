import {
  DOCUMENT_GAP_LABELS,
  documentRequirement,
  isVerifiedDocument,
  type DealerDocumentDto,
  type DocStatus,
  type DocumentRequirementGap,
} from '@dealers-drive/contracts';

const LOCKED_STATUSES: readonly DocStatus[] = ['UPLOADED', 'VERIFIED'];

export function outstandingDocuments(
  documents: readonly DealerDocumentDto[],
  gstin: string | null,
): DocumentRequirementGap[] {
  return documentRequirement(documents, gstin, isVerifiedDocument).gaps;
}

export function gapLabels(gaps: readonly DocumentRequirementGap[]): string[] {
  return gaps.map((gap) => DOCUMENT_GAP_LABELS[gap]);
}

export function isLockedDocument(document: DealerDocumentDto | null): boolean {
  return document !== null && LOCKED_STATUSES.includes(document.status);
}
