'use client';

import { DOCUMENT_MIME_TYPES, type DealerDocumentDto } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { StatusTag } from '@/components/ui/primitives';
import { failureMessage, fileRejection, postJson, presign, putToStorage } from '@/lib/upload';

import {
  DOCUMENT_PATH,
  DOCUMENT_RULE,
  DOCUMENT_UPLOADER_TEXT,
  TAG,
  TONE,
} from './document-uploader.constants';

/**
 * DESIGN-SPEC §3.10 step 3 — one KYC document row.
 *
 * presign → PUT straight to storage → commit, the same three-step contract the
 * vehicle photos use (ARCHITECTURE §12.1). KYC documents are private: there is
 * no public delivery route for them at all — an admin reads one through a
 * short-lived signed URL, and every issue of one is audit-logged (§26.6).
 *
 * **Replace and Remove are two verbs, not one.** Replace is presign → PUT →
 * commit and the API deletes the displaced object as part of it. Remove is the
 * dealer deciding a document should not be there at all — the wrong scan, the
 * wrong dealership's PAN card — and the row goes back to `REQUIRED` with the
 * bytes gone.
 */
export function DocumentUploader({ document }: { document: DealerDocumentDto }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Anything but `REQUIRED` means bytes exist, and bytes can be taken back. */
  const uploaded = document.status !== 'REQUIRED';

  async function upload(file: File): Promise<void> {
    setError(null);

    const rejection = fileRejection(file, DOCUMENT_RULE);
    if (rejection) {
      setError(rejection);
      return;
    }

    setBusy('upload');
    try {
      const signed = await presign(DOCUMENT_PATH.presign, {
        type: document.type,
        fileName: file.name,
        mimeType: file.type,
        bytes: file.size,
      });
      const documentId = signed.documentId;
      if (!documentId) throw new Error(DOCUMENT_UPLOADER_TEXT.missingId);

      await putToStorage(signed, file);

      const commit = await postJson(DOCUMENT_PATH.commit(document.type), { documentId });
      if (!commit.ok) throw new Error(DOCUMENT_UPLOADER_TEXT.commitFailed);

      router.refresh();
    } catch (caught) {
      setError(failureMessage(caught, DOCUMENT_UPLOADER_TEXT.uploadFailed));
    } finally {
      setBusy(null);
    }
  }

  async function remove(): Promise<void> {
    setError(null);
    setBusy('delete');
    try {
      const response = await fetch(DOCUMENT_PATH.remove(document.type), { method: 'DELETE' });
      if (!response.ok) throw new Error(DOCUMENT_UPLOADER_TEXT.removeFailed);
      router.refresh();
    } catch (caught) {
      setError(failureMessage(caught, DOCUMENT_UPLOADER_TEXT.removeUnknown));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-[12px] border border-dashed border-(--color-divider) p-[13px]">
      <div className="flex h-8 w-8 flex-none items-center justify-center bg-(--color-surface) font-mono text-[11px]">
        {document.status === 'VERIFIED'
          ? DOCUMENT_UPLOADER_TEXT.verifiedGlyph
          : document.type.slice(0, 2)}
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
        aria-label={DOCUMENT_UPLOADER_TEXT.inputLabel(document.label)}
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
        {busy === 'upload'
          ? DOCUMENT_UPLOADER_TEXT.uploading
          : uploaded
            ? DOCUMENT_UPLOADER_TEXT.replace
            : DOCUMENT_UPLOADER_TEXT.upload}
      </button>

      {/*
        Only when there is something to delete. A `Delete` next to an empty row is
        a control that cannot do anything, and a disabled one is worse — it
        implies the row is in a state the dealer could get out of.
      */}
      {uploaded ? (
        <button
          type="button"
          className="btn btn-ghost text-[12px] text-(--color-err)"
          disabled={busy !== null}
          onClick={() => void remove()}
        >
          {busy === 'delete' ? DOCUMENT_UPLOADER_TEXT.removing : DOCUMENT_UPLOADER_TEXT.remove}
        </button>
      ) : null}
    </div>
  );
}
