'use client';

import { useState } from 'react';

import { Banner } from '@/components/ui/primitives';

import { DOCUMENT_REVIEW_TEXT } from './document-review.constants';
import type { DocumentReviewProps } from './document-review.types';
import { DocumentRow } from './document-row';

export function DocumentReview({ documents, dealerSlug }: DocumentReviewProps) {
  const [error, setError] = useState<string | null>(null);

  if (documents.length === 0) {
    return <p className="py-3 text-[13px] ink-muted">{DOCUMENT_REVIEW_TEXT.nothingUploaded}</p>;
  }

  return (
    <>
      {error ? <Banner tone="err">{error}</Banner> : null}
      {documents.map((document) => (
        <DocumentRow
          key={document.id}
          document={document}
          dealerSlug={dealerSlug}
          onError={setError}
        />
      ))}
    </>
  );
}
