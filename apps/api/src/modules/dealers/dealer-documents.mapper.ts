import {
  DOC_CATEGORY_LABELS,
  DOC_CATEGORY_TYPES,
  DOC_TYPE_HINTS,
  DOC_TYPE_LABELS,
  SELECTABLE_DOC_CATEGORIES,
  documentRequirement,
  isSubmittedDocument,
  type DealerDocumentDto,
  type DealerDocumentsResponse,
} from '@dealers-drive/contracts';
import type { DealerDocument } from '@prisma/client';

const STATUS_LABELS: Record<DealerDocument['status'], string> = {
  REQUIRED: 'Not uploaded yet — PDF, JPEG or PNG, up to 5 MB',
  UPLOADING: 'Upload not finished — choose the file again',
  UPLOADED: 'Submitted · awaiting review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected — upload a replacement',
};

const ACTIONS: Record<DealerDocument['status'], string> = {
  REQUIRED: 'Upload',
  UPLOADING: 'Upload again',
  UPLOADED: 'Replace',
  VERIFIED: 'Replace',
  REJECTED: 'Resubmit',
};

export function toDealerDocumentDto(row: DealerDocument): DealerDocumentDto {
  return {
    id: row.id,
    category: row.category,
    categoryLabel: DOC_CATEGORY_LABELS[row.category],
    type: row.type,
    label: DOC_TYPE_LABELS[row.type],
    status: row.status,
    statusLabel: STATUS_LABELS[row.status],
    fileName: row.fileName,
    mimeType: row.mimeType,
    bytes: row.bytes,
    description: row.description,
    uploadedAt: row.uploadedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    submissionCount: row.submissionCount,
    action: ACTIONS[row.status],
  };
}

export function toDealerDocuments(
  rows: readonly DealerDocument[],
  gstin: string | null,
): DealerDocumentsResponse {
  const requirement = documentRequirement(rows, gstin, isSubmittedDocument);
  const slots = SELECTABLE_DOC_CATEGORIES.map((category) => {
    const row = rows.find((doc) => doc.category === category && doc.status !== 'REQUIRED');
    return {
      category,
      label: DOC_CATEGORY_LABELS[category],
      types: DOC_CATEGORY_TYPES[category].map((type) => ({
        type,
        label: DOC_TYPE_LABELS[type],
        hint: DOC_TYPE_HINTS[type] ?? null,
      })),
      document: row ? toDealerDocumentDto(row) : null,
    };
  });
  const submitted = rows.filter((row) => row.status !== 'REQUIRED');
  return {
    data: submitted.map(toDealerDocumentDto),
    slots,
    requirementMet: requirement.satisfiedBy !== null,
    gaps: requirement.gaps,
    allVerified: submitted.length > 0 && submitted.every((row) => row.status === 'VERIFIED'),
  };
}

export const EMPTY_DOCUMENT_SLOTS = [
  { category: 'PERSONAL_IDENTITY', type: 'PAN_CARD', status: 'REQUIRED' },
  { category: 'BUSINESS_IDENTITY', type: 'GST_CERTIFICATE', status: 'REQUIRED' },
] as const;
