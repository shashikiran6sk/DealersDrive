import {
  DOC_CATEGORY_TYPES,
  type DealerDocType,
  type DealerDocumentDto,
  type SelectableDocCategory,
} from '@dealers-drive/contracts';

import { DESCRIPTION_LIMITS } from './document-uploader.constants';

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
