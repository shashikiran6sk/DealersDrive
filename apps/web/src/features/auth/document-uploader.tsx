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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    setBusy(true);
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
      setBusy(false);
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
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? 'Uploading…' : document.status === 'REQUIRED' ? 'Upload' : 'Replace'}
      </button>
    </div>
  );
}
