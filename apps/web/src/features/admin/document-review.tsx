'use client';

import type { AdminDealerDetail, StatusTone } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banner, StatusTag } from '@/components/ui/primitives';
import { rejectDocumentAction, verifyDocumentAction } from '@/features/admin/actions';

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
