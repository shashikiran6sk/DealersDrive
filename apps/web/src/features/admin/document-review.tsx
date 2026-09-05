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
 */
const DOC_TONE: Record<AdminDealerDetail['documents'][number]['status'], StatusTone> = {
  REQUIRED: 'neutral',
  UPLOADING: 'neutral',
  UPLOADED: 'warn',
  VERIFIED: 'ok',
  REJECTED: 'err',
};

type Document = AdminDealerDetail['documents'][number];

export function DocumentReview({ documents }: { documents: Document[] }) {
  const [error, setError] = useState<string | null>(null);

  if (documents.length === 0) {
    return <p className="py-3 text-[13px] ink-muted">Nothing uploaded yet.</p>;
  }

  return (
    <>
      {error ? <Banner tone="err">{error}</Banner> : null}
      {documents.map((document) => (
        <DocumentRow key={document.id} document={document} onError={setError} />
      ))}
    </>
  );
}

function DocumentRow({
  document,
  onError,
}: {
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
              onClick={() => run(() => verifyDocumentAction(document.id))}
            >
              Verify
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRejecting((open) => !open)}>
              Reject
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
            onClick={() => run(() => rejectDocumentAction(document.id, { reason: reason.trim() }))}
          >
            Reject document
          </Button>
        </div>
      ) : null}
    </div>
  );
}
