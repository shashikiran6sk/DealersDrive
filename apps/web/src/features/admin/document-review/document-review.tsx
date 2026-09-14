'use client';

import { useState } from 'react';

import { Banner } from '@/components/ui/primitives';

import { DOCUMENT_REVIEW_TEXT } from './document-review.constants';
import type { DocumentReviewProps } from './document-review.types';
import { DocumentRow } from './document-row';

/**
 * D5 — the KYC decision, on the row it is about.
 *
 * The endpoints have existed since F044 and nothing called them, which had a
 * consequence beyond the missing buttons: approving a dealership requires all
 * three documents `VERIFIED`, so with no way to verify one the approve control
 * could never appear.
 *
 * A rejection reason is mandatory and is shown to the dealer verbatim — it is
 * what they re-upload against, so "rejected" on its own costs a round trip.
 *
 * **Rejecting a document is not rejecting the dealer.** It rejects one *file*:
 * the scan is deleted, the row is emptied so the dealer sees the slot they saw
 * before they uploaded, and the application is handed back as a draft so they
 * can reach the upload box at all. The other two documents are untouched. The
 * control that rejects a *dealership* is `DealerAdminActions`, it is behind a
 * confirmation, and it deletes everything.
 */
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
