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

export function DocumentUploader({ document }: { document: DealerDocumentDto }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

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
