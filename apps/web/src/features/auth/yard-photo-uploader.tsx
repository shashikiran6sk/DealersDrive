'use client';

import {
  YARD_PHOTO_MAX_BYTES,
  YARD_PHOTO_MIME_TYPES,
  type PresignResponse,
  type YardPhotoDto,
} from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Banner } from '@/components/ui/primitives';

/**
 * The yard photograph — the hero of the dealership's public portfolio.
 *
 * Same presign → PUT → commit pipeline as the KYC documents beside it, and a
 * deliberately different presentation. A document row is a checklist tick; this
 * is the image a buyer will see first, so the dealer is shown it at a size where
 * they can tell whether it is any good.
 *
 * The instruction text is doing real work and is not filler. A dealer asked for
 * "a photo" sends a phone snap of a car; a dealer told what the image is *for*
 * sends the shot of the entrance they already have. The cost of the second
 * sentence is one line; the cost of not having it is a moderator rejecting the
 * application and a day of round-trip.
 */
export function YardPhotoUploader({ photo }: { photo: YardPhotoDto }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File): Promise<void> {
    setError(null);

    if (file.size > YARD_PHOTO_MAX_BYTES) {
      setError('That image is larger than 10MB.');
      return;
    }
    if (!(YARD_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError('Upload a JPEG, PNG or WebP.');
      return;
    }

    setBusy('upload');
    try {
      const presignResponse = await fetch('/api/dealer/yard-photo/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, bytes: file.size }),
      });
      if (!presignResponse.ok) throw new Error('We could not start that upload.');

      const presign = (await presignResponse.json()) as PresignResponse;
      const mediaId = presign.mediaId;
      if (!mediaId) throw new Error('The upload was signed without a media id.');

      const put = await fetch(presign.uploadUrl, {
        method: presign.method,
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error('The upload was rejected by storage.');

      const commit = await fetch('/api/dealer/yard-photo/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId }),
      });
      if (!commit.ok) throw new Error('We could not record that photo.');

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
      const response = await fetch('/api/dealer/yard-photo', { method: 'DELETE' });
      if (!response.ok) throw new Error('We could not remove that photo.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That could not be removed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-[10px] border border-(--color-divider) bg-white p-[14px]">
      <div>
        <div className="text-[14px] font-medium">Photo of your yard</div>
        <p className="mt-[4px] text-[12px] leading-[1.55] ink-secondary">
          This is the first thing buyers see on your dealership page, so it is worth getting right.
          Send us a <strong>clear, well-lit photograph of your yard or the signboard at your
          entrance</strong> — taken straight on, in daylight, with the whole frontage in frame. Not
          a logo, not a screenshot, and not a photo of one car.
        </p>
      </div>

      {error ? <Banner tone="err">{error}</Banner> : null}

      {photo.url ? (
        <figure className="m-0">
          {/*
            A plain <img>, not next/image. The source is a short-lived signed
            URL against object storage — it changes on every render and the
            optimiser has nothing stable to cache, so routing it through
            /_next/image would cost a round trip per view and buy nothing.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt="The dealership yard, as buyers will see it"
            className="h-[190px] w-full border border-(--color-divider) object-cover"
          />
          <figcaption className="mt-[6px] truncate text-[12px] ink-subtle">
            {photo.fileName ?? 'Uploaded'}
          </figcaption>
        </figure>
      ) : (
        <div className="flex h-[130px] items-center justify-center border border-dashed border-(--color-divider) text-[13px] ink-faint">
          No photo yet — JPEG, PNG or WebP, up to 10 MB
        </div>
      )}

      <input
        ref={input}
        type="file"
        className="sr-only"
        accept={YARD_PHOTO_MIME_TYPES.join(',')}
        aria-label="Upload a photo of your yard"
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
          {busy === 'upload' ? 'Uploading…' : photo.url ? 'Replace photo' : 'Upload photo'}
        </button>

        {photo.url ? (
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
    </div>
  );
}
