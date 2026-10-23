'use client';

import { IMAGE_MIME_TYPES } from '@dealers-drive/contracts';
import { useRef, useState } from 'react';

import { Banner } from '@/components/ui/primitives';
import { removeListingImageAction } from '@/features/admin/listing-actions';

import { ImageTile } from './image-tile';
import { LISTING_IMAGES_TEXT } from './listing-images.constants';
import type { ListingImagesProps, UploadProgress } from './listing-images.types';
import { moved, uploadOne } from './utils';

export function ListingImages({ listingId, images, live = false }: ListingImagesProps) {
  const input = useRef<HTMLInputElement>(null);
  const replacementInput = useRef<HTMLInputElement>(null);
  const replacementTarget = useRef<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const count = images.items.length;
  const order = images.items.map((image) => image.mediaId);
  const room = Math.max(images.max - count, 0);
  const missing = Math.max(images.min - count, 0);
  const busy = removing || progress !== null;

  async function replace(file: File): Promise<void> {
    const target = replacementTarget.current;
    if (!target) return;
    setErrors([]);
    setNotice(null);
    setProgress({ done: 0, total: 1 });
    try {
      const problem = await uploadOne(listingId, file, target);
      setErrors(problem ? [problem] : []);
      if (!problem) setNotice(LISTING_IMAGES_TEXT.replaced);
    } finally {
      setProgress(null);
      replacementTarget.current = null;
    }
  }

  async function remove(mediaId: string): Promise<void> {
    setRemoving(true);
    setErrors([]);
    setNotice(null);
    try {
      const form = new FormData();
      form.set('listingId', listingId);
      form.set('mediaId', mediaId);
      const result = await removeListingImageAction(form);
      if (!result.ok) setErrors([result.message ?? LISTING_IMAGES_TEXT.removeFailed]);
      else setNotice(LISTING_IMAGES_TEXT.removed);
    } finally {
      setRemoving(false);
    }
  }

  async function upload(files: File[]): Promise<void> {
    setErrors([]);
    setNotice(null);
    const accepted = files.slice(0, room);
    const problems: string[] = files.length > room ? [LISTING_IMAGES_TEXT.tooMany(room)] : [];

    for (const [index, file] of accepted.entries()) {
      setProgress({ done: index, total: accepted.length });
      const problem = await uploadOne(listingId, file);
      if (problem) problems.push(problem);
    }

    setProgress(null);
    setErrors(problems);
  }

  return (
    <div className="flex flex-col gap-[10px] border-t border-(--color-divider) pt-[10px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[14px] font-medium">{LISTING_IMAGES_TEXT.heading}</h3>
        <span className="text-[12px] ink-subtle tnum">
          {live
            ? LISTING_IMAGES_TEXT.liveCount(count, images.min, images.max)
            : LISTING_IMAGES_TEXT.count(count, images.min, images.max)}
        </span>
      </div>

      {missing > 0 && images.canEdit && !live ? (
        <p className="text-[12px] text-(--color-warn)">
          {LISTING_IMAGES_TEXT.belowMinimum(missing)}
        </p>
      ) : null}

      {live && images.canEdit ? (
        <p className="text-[12px] ink-subtle">{LISTING_IMAGES_TEXT.liveHint(images.min)}</p>
      ) : null}

      {errors.length > 0 ? (
        <Banner tone="err">
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Banner>
      ) : null}

      {count === 0 ? (
        <p className="text-[13px] ink-muted">{LISTING_IMAGES_TEXT.empty}</p>
      ) : (
        <ol className="grid gap-[8px] [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))] max-md:[grid-template-columns:repeat(auto-fill,minmax(min(120px,100%),1fr))]">
          {images.items.map((image, index) => (
            <ImageTile
              key={image.mediaId}
              listingId={listingId}
              image={image}
              editable={images.canEdit && !busy}
              onReplace={() => {
                replacementTarget.current = image.mediaId;
                replacementInput.current?.click();
              }}
              onRemove={() => {
                void remove(image.mediaId);
              }}
              earlier={moved(order, index, -1)}
              later={moved(order, index, 1)}
            />
          ))}
        </ol>
      )}

      {images.canEdit ? (
        <>
          <input
            ref={replacementInput}
            type="file"
            className="sr-only"
            accept={IMAGE_MIME_TYPES.join(',')}
            aria-label={LISTING_IMAGES_TEXT.replaceInputLabel}
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void replace(file);
            }}
          />
          <input
            ref={input}
            type="file"
            multiple
            disabled={busy}
            className="sr-only"
            accept={IMAGE_MIME_TYPES.join(',')}
            aria-label={LISTING_IMAGES_TEXT.inputLabel}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = '';
              if (files.length > 0) void upload(files);
            }}
          />
          {room === 0 ? (
            <p className="text-[12px] ink-subtle">{LISTING_IMAGES_TEXT.full(images.max)}</p>
          ) : (
            <button
              type="button"
              className="btn btn-secondary self-start text-[12px]"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {progress
                ? LISTING_IMAGES_TEXT.uploading(progress.done, progress.total)
                : LISTING_IMAGES_TEXT.upload}
            </button>
          )}
        </>
      ) : (
        <p className="text-[12px] ink-subtle">{LISTING_IMAGES_TEXT.closed}</p>
      )}
      {progress ? (
        <p role="status" className="text-[12px] ink-subtle">
          {LISTING_IMAGES_TEXT.uploading(progress.done, progress.total)}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-[12px] ink-subtle">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
