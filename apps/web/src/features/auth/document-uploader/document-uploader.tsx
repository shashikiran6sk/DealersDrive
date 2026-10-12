'use client';

import { DOC_CATEGORY_LABELS, DOCUMENT_MIME_TYPES } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';

import { StatusTag } from '@/components/ui/primitives';
import {
  failureMessage,
  fileRejection,
  postJson,
  presign,
  putToStorage,
  UploadFailure,
} from '@/lib/upload';

import { DocumentTypeField } from './document-type-field';
import {
  CATEGORY_GLYPHS,
  CATEGORY_NOTES,
  DEALER_DOCUMENT_BASE,
  DOCUMENT_RULE,
  DOCUMENT_UPLOADER_TEXT,
  documentPaths,
  TAG,
  TONE,
} from './document-uploader.constants';
import type { DocumentUploaderProps } from './document-uploader.types';
import { descriptionIsValid, initialType, needsDescription } from './utils';

export function DocumentUploader({
  category,
  document,
  basePath = DEALER_DOCUMENT_BASE,
  gstinOnFile = false,
}: DocumentUploaderProps) {
  const paths = documentPaths(basePath);
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [type, setType] = useState(() => initialType(category, document, gstinOnFile));
  const [description, setDescription] = useState(document?.description ?? '');
  const [busy, setBusy] = useState<'upload' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const label = DOC_CATEGORY_LABELS[category];
  const headingId = `${id}-heading`;
  const status = document?.status ?? 'REQUIRED';
  const uploaded = status !== 'REQUIRED';

  function readyProblem(): string | null {
    if (!type) return DOCUMENT_UPLOADER_TEXT.chooseType;
    if (needsDescription(type) && !descriptionIsValid(description)) {
      return DOCUMENT_UPLOADER_TEXT.describeFirst;
    }
    return null;
  }

  function choose(): void {
    const problem = readyProblem();
    setError(problem);
    if (!problem) input.current?.click();
  }

  async function upload(file: File): Promise<void> {
    setError(null);

    if (!type) {
      setError(DOCUMENT_UPLOADER_TEXT.chooseType);
      return;
    }
    const problem = readyProblem() ?? fileRejection(file, DOCUMENT_RULE);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy('upload');
    try {
      const signed = await presign(paths.presign, {
        category,
        type,
        fileName: file.name,
        mimeType: file.type,
        bytes: file.size,
        ...(needsDescription(type) ? { description: description.trim() } : {}),
      });
      const documentId = signed.documentId;
      if (!documentId) throw new UploadFailure(DOCUMENT_UPLOADER_TEXT.missingId);

      await putToStorage(signed, file);

      const commit = await postJson(paths.commit(category), { documentId });
      if (!commit.ok) throw new UploadFailure(DOCUMENT_UPLOADER_TEXT.commitFailed);

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
      const response = await fetch(paths.remove(category), { method: 'DELETE' });
      if (!response.ok) throw new UploadFailure(DOCUMENT_UPLOADER_TEXT.removeFailed);
      router.refresh();
    } catch (caught) {
      setError(failureMessage(caught, DOCUMENT_UPLOADER_TEXT.removeUnknown));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-[12px] border border-(--color-divider) bg-white p-[14px]"
    >
      <div className="flex items-start gap-[10px]">
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="text-[14px] font-medium">
            {label}
          </h3>
          <p className="mt-[2px] text-[12px] leading-[1.5] ink-subtle">
            {CATEGORY_NOTES[category]}
          </p>
        </div>
        <StatusTag tone={TONE[status]}>{TAG[status]}</StatusTag>
      </div>

      <DocumentTypeField
        id={id}
        category={category}
        type={type}
        onTypeChange={setType}
        description={description}
        onDescriptionChange={setDescription}
        gstinOnFile={gstinOnFile}
        disabled={busy !== null}
      />

      <div className="flex flex-wrap items-center gap-[12px] border border-dashed border-(--color-divider) p-[11px]">
        <div className="flex h-8 w-8 flex-none items-center justify-center bg-(--color-surface) font-mono text-[11px]">
          {status === 'VERIFIED' ? DOCUMENT_UPLOADER_TEXT.verifiedGlyph : CATEGORY_GLYPHS[category]}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">
            {document?.fileName ?? DOCUMENT_UPLOADER_TEXT.noFile}
          </div>
          {document && uploaded ? (
            <div className="truncate text-[12px] ink-subtle">
              {DOCUMENT_UPLOADER_TEXT.fileMeta(document.label, document.statusLabel)}
            </div>
          ) : null}
        </div>

        <input
          ref={input}
          type="file"
          className="sr-only"
          accept={DOCUMENT_MIME_TYPES.join(',')}
          aria-label={DOCUMENT_UPLOADER_TEXT.inputLabel(label)}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = '';
          }}
        />

        <div className="flex gap-[8px]">
          <button
            type="button"
            className="btn btn-secondary text-[12px]"
            disabled={busy !== null}
            onClick={choose}
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
      </div>

      {document?.rejectionReason && status === 'REJECTED' ? (
        <p className="text-[12px] text-(--color-err)">
          {DOCUMENT_UPLOADER_TEXT.rejected(document.rejectionReason)}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-[12px] text-(--color-err)">
          {error}
        </p>
      ) : null}
    </section>
  );
}
