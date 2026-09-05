'use client';

import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  type DealerDocumentDto,
  type PresignResponse,
} from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { StatusTag } from '@/components/ui/primitives';
import type { StatusTone } from '@dealers-drive/contracts';

/**
 * DESIGN-SPEC §3.10 step 3 — one KYC document row.
 *
 * presign → PUT straight to storage → commit, the same three-step contract the
 * vehicle photos use (ARCHITECTURE §12.1). The file never passes through the
 * Next server: only the signing and commit calls are proxied, because those
 * need the session.
 *
 * KYC documents are private. There is no public delivery route for them at all
 * — an admin reads one through a short-lived signed URL, and every issue of one
 * is audit-logged (§26.6).
 *
 * **Replace and Remove are two verbs, not one.** Replace is presign → PUT →
 * commit and the API deletes the displaced object as part of it. Remove is the
 * dealer deciding a document should not be there at all — the wrong scan, the
 * wrong dealership's PAN card — and the row goes back to `REQUIRED` with the
 * bytes gone. Without the second, the only way to correct a mistake is to
 * upload something else over the top of it, which is not the same thing.
 */
const TONE: Record<DealerDocumentDto['status'], StatusTone> = {
  REQUIRED: 'neutral',
  UPLOADING: 'neutral',
  UPLOADED: 'warn',
  VERIFIED: 'ok',
  REJECTED: 'err',
};

/**
 * A tag is a state, not a sentence. The API's `statusLabel` is written for the
 * row's sub-line ("Required — PDF or JPG, max 5 MB"); repeating it inside the
 * tag says the same thing twice and pushes the row over its width.
 */
const TAG: Record<DealerDocumentDto['status'], string> = {
  REQUIRED: 'Required',
  UPLOADING: 'Uploading',
  UPLOADED: 'In review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

export function DocumentUploader({ document }: { document: DealerDocumentDto }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Anything but `REQUIRED` means bytes exist, and bytes can be taken back. */
  const uploaded = document.status !== 'REQUIRED';

  async function upload(file: File): Promise<void> {
    setError(null);

    if (file.size > DOCUMENT_MAX_BYTES) {
      setError('That file is larger than 5MB.');
      return;
    }
    if (!(DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError('Upload a PDF, JPEG or PNG.');
      return;
    }

    setBusy('upload');
    try {
      const presignResponse = await fetch('/api/dealer/documents/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: document.type,
          fileName: file.name,
          mimeType: file.type,
          bytes: file.size,
        }),
      });
      if (!presignResponse.ok) throw new Error('We could not start that upload.');

      const presign = (await presignResponse.json()) as PresignResponse;
      const documentId = presign.documentId;
      if (!documentId) throw new Error('The upload was signed without a document id.');

      const put = await fetch(presign.uploadUrl, {
        method: presign.method,
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error('The upload was rejected by storage.');

      const commit = await fetch(`/api/dealer/documents/${document.type}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });
      if (!commit.ok) throw new Error('We could not record that document.');

      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That upload failed.');
    } finally {
      setBusy(null);
    }
  }

  async function remove(): Promise<void> {
    setError(null);
    setBusy('delete');
    try {
      const response = await fetch(`/api/dealer/documents/${document.type}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('We could not remove that document.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That could not be removed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-[12px] border border-dashed border-(--color-divider) p-[13px]">
      <div className="flex h-8 w-8 flex-none items-center justify-center bg-(--color-surface) font-mono text-[11px]">
        {document.status === 'VERIFIED' ? '✓' : document.type.slice(0, 2)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium">{document.label}</div>
        <div className="truncate text-[12px] ink-subtle">
          {error ?? document.rejectionReason ?? document.fileName ?? document.statusLabel}
        </div>
      </div>

      <StatusTag tone={TONE[document.status]}>{TAG[document.status]}</StatusTag>

      <input
        ref={input}
        type="file"
        className="sr-only"
        accept={DOCUMENT_MIME_TYPES.join(',')}
        aria-label={`Upload ${document.label}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = '';
        }}
      />

      <button
        type="button"
        className="btn btn-secondary text-[12px]"
        disabled={busy !== null}
        onClick={() => input.current?.click()}
      >
        {busy === 'upload' ? 'Uploading…' : uploaded ? 'Replace' : 'Upload'}
      </button>

      {/*
        Only when there is something to delete. A `Delete` next to an empty row
        is a control that cannot do anything, and a disabled one is worse — it
        implies the row is in a state the dealer could get out of.
      */}
      {uploaded ? (
        <button
          type="button"
          className="btn btn-ghost text-[12px] text-(--color-err)"
          disabled={busy !== null}
          onClick={() => void remove()}
        >
          {busy === 'delete' ? 'Removing…' : 'Delete'}
        </button>
      ) : null}
    </div>
  );
}
