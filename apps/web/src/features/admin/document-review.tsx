'use client';

import type { AdminDealerDetail, StatusTone } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banner, StatusTag } from '@/components/ui/primitives';
import { rejectDocumentAction, verifyDocumentAction } from '@/features/admin/actions';

/**
 * D5 — the KYC decision, on the row it is about.
 *
 * The endpoints have existed since F044 and nothing called them, which had a
 * consequence beyond the missing buttons: approving a dealership requires all
 * three documents `VERIFIED`, so with no way to verify one from the console the
 * approve control could never appear. This is the other half of that fix.
 *
 * A rejection reason is mandatory and is shown to the dealer verbatim — it is
 * what they re-upload against, so "rejected" on its own costs a round trip.
 *
 * **Rejecting a document is not rejecting the dealer**, and the copy on this
 * row says so, because the word is the same and the consequence is not. It
 * rejects one *file*: the scan is deleted from storage, the row is emptied so
 * the dealer sees the slot they saw before they uploaded, and the application
 * is handed back to them as a draft so they can reach the upload box at all.
 * The other two documents are untouched. The control that rejects a
 * *dealership* is in `DealerAdminActions` below, it is behind a confirmation,
 * and it deletes everything.
 */
const DOC_TONE: Record<AdminDealerDetail['documents'][number]['status'], StatusTone> = {
  REQUIRED: 'neutral',
  UPLOADING: 'neutral',
  UPLOADED: 'warn',
  VERIFIED: 'ok',
  REJECTED: 'err',
};

type Document = AdminDealerDetail['documents'][number];

export function DocumentReview({
  documents,
  dealerSlug,
}: {
  documents: Document[];
  /**
   * The dealership these documents belong to, for cache invalidation only.
   *
   * Rejecting one can hand a PENDING_APPROVAL application back to DRAFT, and a
   * dealership that is not ACTIVE is not public — so a decision here can remove
   * a portfolio from the marketplace, and the cached copy has to go with it.
   */
  dealerSlug: string;
}) {
  const [error, setError] = useState<string | null>(null);

  if (documents.length === 0) {
    return <p className="py-3 text-[13px] ink-muted">Nothing uploaded yet.</p>;
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

function DocumentRow({
  document,
  dealerSlug,
  onError,
}: {
  dealerSlug: string;
  document: Document;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Only a document that has actually been uploaded can be decided on. A
  // REQUIRED row has no file behind it, and a decided one is re-decided by the
  // dealer re-uploading, not by a moderator changing their mind in place.
  //
  // A REJECTED row is now genuinely empty — the file was deleted when it was
  // rejected — which is why it reads the same as REQUIRED here and to the
  // dealer: a slot waiting for an upload, with the reason underneath.
  const decidable = document.status === 'UPLOADED';

  function run(work: () => Promise<{ ok: boolean; message?: string }>) {
    onError(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        onError(result.message ?? 'That decision did not go through.');
        return;
      }
      setRejecting(false);
      setReason('');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 border-b border-(--color-divider) py-[9px] text-[13px] last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate">{document.label}</span>

        {/* `viewUrl` is short-lived and audit-logged — it is the only
            way a KYC document is ever read (D5). */}
        {document.viewUrl ? (
          <a
            href={document.viewUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-ghost text-[11px]"
          >
            View
          </a>
        ) : null}

        {decidable ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              loading={pending}
              onClick={() => run(() => verifyDocumentAction(document.id, dealerSlug))}
            >
              Verify
            </Button>
            {/* "Reject file", not "Reject" — the word on its own is the one
                that gets read as a verdict on the dealership. */}
            <Button variant="ghost" size="sm" onClick={() => setRejecting((open) => !open)}>
              Reject file
            </Button>
          </>
        ) : null}

        <StatusTag tone={DOC_TONE[document.status]}>{document.status}</StatusTag>
      </div>

      {document.rejectionReason ? (
        <p className="text-[12px] ink-muted">Rejected: {document.rejectionReason}</p>
      ) : null}

      {rejecting ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={`Reason for rejecting ${document.label}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Shown to the dealer verbatim — say what to re-upload"
            className="min-w-[240px] flex-1"
          />
          <Button
            variant="destructive"
            size="sm"
            loading={pending}
            disabled={reason.trim().length < 6}
            onClick={() =>
              run(() => rejectDocumentAction(document.id, { reason: reason.trim() }, dealerSlug))
            }
          >
            Ask for a new file
          </Button>
          {/*
            The consequence, stated before the button is pressed. It is not a
            verdict on the dealership — but it does delete a file and reopen the
            application, and both are surprising if unannounced.
          */}
          <p className="w-full text-[12px] ink-muted">
            Deletes this file and asks the dealer to upload {document.label} again. The other
            documents and everything else they entered are untouched; their application returns to
            draft so they can reach the upload box.
          </p>
        </div>
      ) : null}
    </div>
  );
}
