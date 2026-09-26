'use client';

import { IMAGE_MIME_TYPES } from '@dealers-drive/contracts';
import { useRef, useState } from 'react';

import { Banner } from '@/components/ui/primitives';

import { ImageTile } from './image-tile';
import { LISTING_IMAGES_TEXT } from './listing-images.constants';
import type { ListingImagesProps, UploadProgress } from './listing-images.types';
import { uploadOne } from './utils';

export function ListingImages({ listingId, images }: ListingImagesProps) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const count = images.items.length;
  const room = Math.max(images.max - count, 0);
  const missing = Math.max(images.min - count, 0);

  async function upload(files: File[]): Promise<void> {
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
          {LISTING_IMAGES_TEXT.count(count, images.min, images.max)}
        </span>
      </div>

      {missing > 0 && images.canEdit ? (
        <p className="text-[12px] text-(--color-warn)">
          {LISTING_IMAGES_TEXT.belowMinimum(missing)}
        </p>
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
        <ol className="grid gap-[8px] [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
          {images.items.map((image) => (
            <ImageTile
              key={image.mediaId}
              listingId={listingId}
              image={image}
              editable={images.canEdit && progress === null}
            />
          ))}
        </ol>
      )}

      {images.canEdit ? (
        <>
          <input
            ref={input}
            type="file"
            multiple
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
              disabled={progress !== null}
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
    </div>
  );
}
