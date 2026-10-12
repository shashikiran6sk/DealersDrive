import { SELECTABLE_DOC_CATEGORIES } from '@dealers-drive/contracts';

import { DocumentUploader, documentForCategory } from '@/features/auth/document-uploader';

import { DOCUMENTS_TEXT } from './documents-overview.constants';
import type { DocumentsOverviewProps } from './documents-overview.types';
import { DocumentsStatus } from './documents-status';
import { isLockedDocument, outstandingDocuments } from './utils';

export function DocumentsOverview({ documents, gstin, dealerStatus }: DocumentsOverviewProps) {
  const gaps = outstandingDocuments(documents, gstin);

  return (
    <div className="flex max-w-[720px] flex-col gap-[18px]">
      <div className="flex flex-col gap-[6px]">
        <h1 className="text-[25px] tracking-[-0.035em] md:text-[30px]">{DOCUMENTS_TEXT.heading}</h1>
        <p className="max-w-[64ch] text-[13px] ink-muted">{DOCUMENTS_TEXT.intro}</p>
      </div>

      <DocumentsStatus gaps={gaps} active={dealerStatus === 'ACTIVE'} />

      <div className="flex flex-col gap-[10px]">
        {SELECTABLE_DOC_CATEGORIES.map((category) => {
          const document = documentForCategory(documents, category);
          return (
            <DocumentUploader
              key={category}
              category={category}
              document={document}
              gstin={gstin}
              locked={isLockedDocument(document)}
              requiredTag={DOCUMENTS_TEXT.notUploaded}
            />
          );
        })}
      </div>

      <p className="max-w-[64ch] text-[13px] ink-muted">{DOCUMENTS_TEXT.dealerVerifiedNote}</p>
    </div>
  );
}
