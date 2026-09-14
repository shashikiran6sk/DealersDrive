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

const TONE: Record<DealerDocumentDto['status'], StatusTone> = {
  REQUIRED: 'neutral',
  UPLOADING: 'neutral',
  UPLOADED: 'warn',
  VERIFIED: 'ok',
  REJECTED: 'err',
};

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
