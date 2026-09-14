'use client';

import { YARD_PHOTO_MIME_TYPES, type YardPhotoDto } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Banner } from '@/components/ui/primitives';
import { failureMessage, fileRejection, postJson, presign, putToStorage } from '@/lib/upload';

import { YARD_PHOTO_PATH, YARD_PHOTO_RULE, YARD_PHOTO_TEXT } from './yard-photo-uploader.constants';

export function YardPhotoUploader({ photo }: { photo: YardPhotoDto }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File): Promise<void> {
    setError(null);

    const rejection = fileRejection(file, YARD_PHOTO_RULE);
    if (rejection) {
      setError(rejection);
      return;
    }

    setBusy('upload');
    try {
      const signed = await presign(YARD_PHOTO_PATH.presign, {
        fileName: file.name,
        mimeType: file.type,
        bytes: file.size,
      });
      const mediaId = signed.mediaId;
      if (!mediaId) throw new Error(YARD_PHOTO_TEXT.missingId);

      await putToStorage(signed, file);

      const commit = await postJson(YARD_PHOTO_PATH.commit, { mediaId });
      if (!commit.ok) throw new Error(YARD_PHOTO_TEXT.commitFailed);

      router.refresh();
    } catch (caught) {
      setError(failureMessage(caught, YARD_PHOTO_TEXT.uploadFailed));
    } finally {
      setBusy(null);
    }
  }

  async function remove(): Promise<void> {
    setError(null);
    setBusy('delete');
    try {
      const response = await fetch(YARD_PHOTO_PATH.remove, { method: 'DELETE' });
      if (!response.ok) throw new Error(YARD_PHOTO_TEXT.removeFailed);
      router.refresh();
    } catch (caught) {
      setError(failureMessage(caught, YARD_PHOTO_TEXT.removeUnknown));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-[10px] border border-(--color-divider) bg-white p-[14px]">
      <div>
        <div className="text-[14px] font-medium">{YARD_PHOTO_TEXT.heading}</div>
        <p className="mt-[4px] text-[12px] leading-[1.55] ink-secondary">
          This is the first thing buyers see on your dealership page, so it is worth getting right.
          Send us a{' '}
          <strong>clear, well-lit photograph of your yard or the signboard at your entrance</strong>{' '}
          — taken straight on, in daylight, with the whole frontage in frame. Not a logo, not a
          screenshot, and not a photo of one car.
        </p>
      </div>

      {error ? <Banner tone="err">{error}</Banner> : null}

      {photo.url ? (
        <figure className="m-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={YARD_PHOTO_TEXT.imageAlt}
            className="h-[190px] w-full border border-(--color-divider) object-cover"
          />
          <figcaption className="mt-[6px] truncate text-[12px] ink-subtle">
            {photo.fileName ?? YARD_PHOTO_TEXT.uploaded}
          </figcaption>
        </figure>
      ) : (
        <div className="flex h-[130px] items-center justify-center border border-dashed border-(--color-divider) text-[13px] ink-faint">
          {YARD_PHOTO_TEXT.emptySlot}
        </div>
      )}

      <input
        ref={input}
        type="file"
        className="sr-only"
        accept={YARD_PHOTO_MIME_TYPES.join(',')}
        aria-label={YARD_PHOTO_TEXT.inputLabel}
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
          onClick={() => input.current?.click()}
        >
          {busy === 'upload'
            ? YARD_PHOTO_TEXT.uploading
            : photo.url
              ? YARD_PHOTO_TEXT.replace
              : YARD_PHOTO_TEXT.upload}
        </button>

        {photo.url ? (
          <button
            type="button"
            className="btn btn-ghost text-[12px] text-(--color-err)"
            disabled={busy !== null}
            onClick={() => void remove()}
          >
            {busy === 'delete' ? YARD_PHOTO_TEXT.removing : YARD_PHOTO_TEXT.remove}
          </button>
        ) : null}
      </div>
    </div>
  );
}
