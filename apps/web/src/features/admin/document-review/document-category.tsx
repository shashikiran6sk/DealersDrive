import { DOCUMENT_REVIEW_TEXT } from './document-review.constants';
import { DocumentRow } from './document-row';
import type { DocumentGroup } from './utils';

export interface DocumentCategoryProps {
  group: DocumentGroup;
  dealerSlug: string;
  onError: (message: string | null) => void;
}

export function DocumentCategory({ group, dealerSlug, onError }: DocumentCategoryProps) {
  return (
    <div className="flex flex-col pt-2">
      <h3 className="eyebrow">{group.label}</h3>
      {group.documents.length === 0 ? (
        <p className="py-2 text-[13px] ink-muted">{DOCUMENT_REVIEW_TEXT.nothingInCategory}</p>
      ) : (
        group.documents.map((document) => (
          <DocumentRow
            key={document.id}
            document={document}
            dealerSlug={dealerSlug}
            onError={onError}
          />
        ))
      )}
    </div>
  );
}
