import {
  DOC_CATEGORY_TYPES,
  OptionalGstin,
  ProblemDetails,
  type DealerDocType,
  type DealerDocumentDto,
  type DocumentCommitInput,
  type SelectableDocCategory,
} from '@dealers-drive/contracts';

import {
  DESCRIPTION_LIMITS,
  DOCUMENT_UPLOADER_TEXT,
  GSTIN_FIELD,
} from './document-uploader.constants';
import type { CommitRefusal } from './document-uploader.types';

export function documentForCategory(
  documents: readonly DealerDocumentDto[],
  category: SelectableDocCategory,
): DealerDocumentDto | null {
  return (
    documents.find(
      (document) => document.category === category && document.status !== 'REQUIRED',
    ) ?? null
  );
}

export function categoryType(category: SelectableDocCategory, value: string): DealerDocType | '' {
  return DOC_CATEGORY_TYPES[category].find((type) => type === value) ?? '';
}

export function initialType(
  category: SelectableDocCategory,
  document: DealerDocumentDto | null,
  gstinOnFile: boolean,
): DealerDocType | '' {
  if (document && document.status !== 'REQUIRED') return categoryType(category, document.type);
  if (category === 'BUSINESS_IDENTITY' && gstinOnFile) return 'GST_CERTIFICATE';
  return '';
}

export function needsDescription(type: DealerDocType | ''): boolean {
  return type === 'OTHER_BUSINESS_CERTIFICATE';
}

export function descriptionIsValid(description: string): boolean {
  const length = description.trim().length;
  return length >= DESCRIPTION_LIMITS.min && length <= DESCRIPTION_LIMITS.max;
}

export function carriesGstin(type: DealerDocType | ''): boolean {
  return type === 'GST_CERTIFICATE';
}

export function gstinProblem(value: string): string | null {
  const parsed = OptionalGstin.safeParse(value);
  if (parsed.success) return null;
  return parsed.error.issues[0]?.message ?? DOCUMENT_UPLOADER_TEXT.gstinInvalid;
}

export function commitBody(
  documentId: string,
  type: DealerDocType | '',
  gstin: string,
): DocumentCommitInput {
  if (!carriesGstin(type)) return { documentId };
  const value = gstin.trim().toUpperCase();
  return { documentId, gstin: value === '' ? null : value };
}

export async function commitRefusal(response: Response): Promise<CommitRefusal> {
  const body: unknown = await response.json().catch(() => null);
  const problem = ProblemDetails.safeParse(body);
  if (!problem.success || response.status >= 500) {
    return { message: DOCUMENT_UPLOADER_TEXT.commitFailed, gstin: null };
  }
  const gstin = problem.data.errors?.find((entry) => entry.field === GSTIN_FIELD)?.message ?? null;
  const message = problem.data.detail ?? DOCUMENT_UPLOADER_TEXT.commitFailed;
  return { message: message === gstin ? null : message, gstin };
}
