'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusTag } from '@/components/ui/primitives';
import { rejectDocumentAction, verifyDocumentAction } from '@/features/admin/actions';
import type { ActionResult } from '@/types';

import {
  DOC_TONE,
  DOCUMENT_REVIEW_TEXT,
  MIN_REJECTION_REASON,
} from './document-review.constants';
import type { AdminDocument } from './document-review.types';

export interface DocumentRowProps {
  dealerSlug: string;
  document: AdminDocument;
  onError: (message: string | null) => void;
}

export function DocumentRow({ document, dealerSlug, onError }: DocumentRowProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  /*
   * Only a document that has actually been uploaded can be decided on: a
   * REQUIRED row has no file behind it, and a decided one is re-decided by the
   * dealer re-uploading rather than by a moderator changing their mind in place.
   * A REJECTED row is genuinely empty — the file was deleted when it was
   * rejected — which is why it reads the same as REQUIRED.
   */
  const decidable = document.status === 'UPLOADED';

  function run(work: () => Promise<ActionResult>) {
    onError(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        onError(result.message ?? DOCUMENT_REVIEW_TEXT.decisionFailed);
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

        {/* `viewUrl` is short-lived and audit-logged — the only way a KYC
            document is ever read (D5). */}
        {document.viewUrl ? (
          <a
            href={document.viewUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-ghost text-[11px]"
          >
            {DOCUMENT_REVIEW_TEXT.view}
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
              {DOCUMENT_REVIEW_TEXT.verify}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRejecting((open) => !open)}>
              {DOCUMENT_REVIEW_TEXT.rejectFile}
            </Button>
          </>
        ) : null}

        <StatusTag tone={DOC_TONE[document.status]}>{document.status}</StatusTag>
      </div>

      {document.rejectionReason ? (
        <p className="text-[12px] ink-muted">
          {DOCUMENT_REVIEW_TEXT.rejectedPrefix}
          {document.rejectionReason}
        </p>
      ) : null}

      {rejecting ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={DOCUMENT_REVIEW_TEXT.reasonLabel(document.label)}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={DOCUMENT_REVIEW_TEXT.reasonPlaceholder}
            className="min-w-[240px] flex-1"
          />
          <Button
            variant="destructive"
            size="sm"
            loading={pending}
            disabled={reason.trim().length < MIN_REJECTION_REASON}
            onClick={() =>
              run(() => rejectDocumentAction(document.id, { reason: reason.trim() }, dealerSlug))
            }
          >
            {DOCUMENT_REVIEW_TEXT.askForNewFile}
          </Button>
          {/* The consequence, stated before the button is pressed. */}
          <p className="w-full text-[12px] ink-muted">
            {DOCUMENT_REVIEW_TEXT.rejectConsequence(document.label)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
