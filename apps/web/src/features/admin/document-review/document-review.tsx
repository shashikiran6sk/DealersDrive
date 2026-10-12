'use client';

import { useState } from 'react';

import { Banner } from '@/components/ui/primitives';

import { DocumentCategory } from './document-category';
import { DocumentGaps } from './document-gaps';
import { DocumentHistory } from './document-history';
import { DOCUMENT_REVIEW_TEXT } from './document-review.constants';
import type { DocumentReviewProps } from './document-review.types';
import { groupByCategory } from './utils';

export function DocumentReview({
  documents,
  dealerSlug,
  gaps = [],
  history = [],
}: DocumentReviewProps) {
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {error ? <Banner tone="err">{error}</Banner> : null}
      <DocumentGaps gaps={gaps} />
      {documents.length === 0 ? (
        <p className="py-3 text-[13px] ink-muted">{DOCUMENT_REVIEW_TEXT.nothingUploaded}</p>
      ) : (
        groupByCategory(documents).map((group) => (
          <DocumentCategory
            key={group.category}
            group={group}
            dealerSlug={dealerSlug}
            onError={setError}
          />
        ))
      )}
      <DocumentHistory history={history} />
    </>
  );
}
