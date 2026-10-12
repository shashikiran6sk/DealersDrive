import { DOC_CATEGORY_LABELS, type DealerDocCategory } from '@dealers-drive/contracts';

import { formatIstDate } from '@/lib/dates';

import { BYTE_UNITS, CATEGORY_ORDER, DOCUMENT_REVIEW_TEXT } from './document-review.constants';
import type { AdminDocument } from './document-review.types';

export interface DocumentGroup {
  category: DealerDocCategory;
  label: string;
  documents: AdminDocument[];
}

export function groupByCategory(documents: readonly AdminDocument[]): DocumentGroup[] {
  return CATEGORY_ORDER.flatMap((category) => {
    const held = documents.filter((document) => document.category === category);
    if (held.length === 0 && category === 'SUPPORTING') return [];
    return [
      {
        category,
        label: held[0]?.categoryLabel ?? DOC_CATEGORY_LABELS[category],
        documents: held,
      },
    ];
  });
}

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? String(value) : value.toFixed(value < 10 ? 1 : 0);
  return `${rounded} ${BYTE_UNITS[unit] ?? 'B'}`;
}

export function fileTypeLabel(mimeType: string): string {
  return (mimeType.split('/').pop() ?? mimeType).toUpperCase();
}

export function documentFacts(document: AdminDocument): string[] {
  return [
    document.fileName,
    document.bytes === null ? null : formatBytes(document.bytes),
    document.mimeType === null ? null : fileTypeLabel(document.mimeType),
    document.submissionCount > 0
      ? DOCUMENT_REVIEW_TEXT.submissions(document.submissionCount)
      : null,
    document.uploadedAt === null
      ? null
      : DOCUMENT_REVIEW_TEXT.uploadedOn(formatIstDate(document.uploadedAt)),
    document.reviewedAt === null
      ? null
      : DOCUMENT_REVIEW_TEXT.reviewedOn(formatIstDate(document.reviewedAt)),
  ].filter((fact): fact is string => fact !== null);
}
