'use client';

import {
  IMAGE_MAX_BYTES,
  type PresignResponse,
  type VehicleMediaDto,
} from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Banner, Plate } from '@/components/ui/primitives';
import { deleteMediaAction, reorderMediaAction } from '@/features/vehicle/actions';
import { cn } from '@/lib/cn';

/**
 * DESIGN-SPEC §3.14 step 3, ARCHITECTURE §12.1.
 *
 * The upload is **direct to object storage**: presign, then `PUT` the bytes at
 * the signed URL from the browser, then commit. The bytes never pass through
 * the Next server, so a dealer uploading twelve 8MB photos costs us nothing but
 * a signature. Processing (re-encode, EXIF strip, derivatives, blurhash) is
 * asynchronous, so a committed photo is polled until it reports READY.
 *
 * Photos are pre-compressed to a 2400px longest edge at q0.85 before presign,
 * which is what makes a 12MB phone photo an acceptable upload on a yard's 4G.
 */
const MAX_EDGE = 2400;
const QUALITY = 0.85;
const POLL_INTERVAL_MS = 1200;
const POLL_LIMIT = 25;

/** The six supporting shots beside the hero: front, rear, both sides, interior, odometer. */
const SUPPORTING_SLOTS = 6;

interface Upload {
  key: string;
  fileName: string;
  percent: number;
  error?: string;
}

export function PhotoUploader({
  vehicleId,
  media,
  minPhotos,
}: {
  vehicleId: string;
  media: VehicleMediaDto[];
  minPhotos: number;
}) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function addFiles(files: FileList | File[]) {
    setError(null);
    const list = Array.from(files);

    for (const [index, file] of list.entries()) {
      const key = `${file.name}:${Date.now()}:${index}`;
      setUploads((current) => [...current, { key, fileName: file.name, percent: 0 }]);

      try {
        await uploadOne(file, media.length + index, (percent) =>
          setUploads((current) =>
            current.map((entry) => (entry.key === key ? { ...entry, percent } : entry)),
          ),
        );
        setUploads((current) => current.filter((entry) => entry.key !== key));
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Upload failed.';
        setUploads((current) =>
          current.map((entry) => (entry.key === key ? { ...entry, error: message } : entry)),
        );
      }
    }

    router.refresh();
  }

  async function uploadOne(
    file: File,
    position: number,
    onProgress: (percent: number) => void,
  ): Promise<void> {
    if (file.size > IMAGE_MAX_BYTES) throw new Error('That photo is larger than 10MB.');

    const { blob, width, height } = await compress(file);
    onProgress(10);

    const presignResponse = await fetch('/api/dealer/media/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerType: 'VEHICLE',
        ownerId: vehicleId,
        fileName: file.name,
        mimeType: blob.type,
        bytes: blob.size,
        width,
        height,
      }),
    });
    if (!presignResponse.ok) throw new Error('We could not start that upload.');
    const presign = (await presignResponse.json()) as PresignResponse;
    // `PresignResponse` is shared with KYC documents, where the id is
    // `documentId` instead — a VEHICLE presign always answers with `mediaId`.
    const mediaId = presign.mediaId;
    if (!mediaId) throw new Error('The upload was signed without a media id.');
    onProgress(25);

    // Straight to storage. `Content-Type` and `Content-Length` are baked into
    // the signature, so the bytes cannot be swapped for something else.
    const put = await fetch(presign.uploadUrl, {
      method: presign.method,
      headers: { 'Content-Type': blob.type },
      body: blob,
    });
    if (!put.ok) throw new Error('The upload was rejected by storage.');
    onProgress(70);

    const commit = await fetch(`/api/dealer/media/${mediaId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position }),
    });
    if (!commit.ok) throw new Error('We could not save that photo.');
    onProgress(80);

    await pollUntilReady(mediaId, onProgress);
  }

  async function remove(mediaId: string) {
    const result = await deleteMediaAction(mediaId);
    if (!result.ok) setError(result.message ?? 'We could not remove that photo.');
    router.refresh();
  }

  async function move(mediaId: string, delta: -1 | 1) {
    const order = media.map((entry) => entry.mediaId);
    const from = order.indexOf(mediaId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return;

    const moved = order[from];
    const displaced = order[to];
    if (moved === undefined || displaced === undefined) return;
    order[from] = displaced;
    order[to] = moved;

    // The full array, always — never a partial swap (§12.2).
    const result = await reorderMediaAction(vehicleId, { mediaIds: order });
    if (!result.ok) setError(result.message ?? 'We could not reorder those photos.');
    router.refresh();
  }

  const shortfall = minPhotos - media.length;

  function pick() {
    inputRef.current?.click();
  }

  // Position 0 is PRIMARY — the API decides that, and reordering is what moves
  // it (C14), so the hero is simply "the first one".
  const hero = media[0] ?? null;
  const supporting = Array.from(
    { length: SUPPORTING_SLOTS },
    (_, index) => media[index + 1] ?? null,
  );
  const overflow = media.slice(SUPPORTING_SLOTS + 1);

  return (
    <div className="flex flex-col gap-3">
      {error ? <Banner tone="err">{error}</Banner> : null}

      {shortfall > 0 ? (
        <Banner tone="warn">
          <span className="tnum">{shortfall}</span> more{' '}
          {shortfall === 1 ? 'photo' : 'photos'} needed — a listing goes to review with at least{' '}
          <span className="tnum">{minPhotos}</span>.
        </Banner>
      ) : null}

      {/*
        One hero slot and six supporting ones (DESIGN-SPEC §3.14 step 3).

        The hero is deliberately much larger — it spans the full grid on mobile
        and two of three columns on desktop — because it is the *only* photo
        most buyers see: it is the search-result thumbnail, the card image and
        the share preview. Sizing it like the others invited dealers to treat
        the order as arbitrary, and the first photo would end up being whichever
        one uploaded fastest.

        Empty slots render as placeholders rather than being absent, so the
        shape of a finished listing is visible from the start.
      */}
      <div className="grid gap-[10px] sm:[grid-template-columns:repeat(3,1fr)]">
        <div className="sm:col-span-2 sm:row-span-2">
          {hero ? (
            <PhotoSlot
              photo={hero}
              index={0}
              total={media.length}
              hero
              onMove={move}
              onRemove={remove}
            />
          ) : (
            <EmptySlot hero label="Main photo" onPick={pick} onDropFiles={addFiles} />
          )}
        </div>

        {supporting.map((photo, offset) =>
          photo ? (
            <PhotoSlot
              key={photo.mediaId}
              photo={photo}
              index={offset + 1}
              total={media.length}
              onMove={move}
              onRemove={remove}
            />
          ) : (
            <EmptySlot
              key={`empty-${offset}`}
              label={`Photo ${offset + 2}`}
              onPick={pick}
              onDropFiles={addFiles}
            />
          ),
        )}
      </div>

      {/* Anything past the seventh keeps working — the gallery has no cap and a
          dealer with twelve good photos should not be told to delete five. */}
      {overflow.length > 0 ? (
        <div className="grid gap-[10px] [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
          {overflow.map((photo, offset) => (
            <PhotoSlot
              key={photo.mediaId}
              photo={photo}
              index={SUPPORTING_SLOTS + 1 + offset}
              total={media.length}
              onMove={move}
              onRemove={remove}
            />
          ))}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => {
          if (event.target.files) void addFiles(event.target.files);
          event.target.value = '';
        }}
      />

      {uploads.map((upload) => (
        <div key={upload.key} className="flex flex-col gap-1">
          <div className="flex gap-2 text-[12px]">
            <span className="min-w-0 flex-1 truncate">{upload.fileName}</span>
            <span className={upload.error ? 'text-(--color-err)' : 'ink-subtle tnum'}>
              {upload.error ?? `${upload.percent}%`}
            </span>
          </div>
          <div className="h-1 bg-(--color-neutral-300)">
            <div
              className="h-full bg-(--color-accent)"
              style={{ width: `${upload.percent}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * One filled slot. `hero` only changes the aspect ratio and the badge — the
 * controls are identical, because the hero is just position 0 and swapping it
 * for another photo is an ordinary reorder.
 */
function PhotoSlot({
  photo,
  index,
  total,
  hero = false,
  onMove,
  onRemove,
}: {
  photo: VehicleMediaDto;
  index: number;
  total: number;
  hero?: boolean;
  onMove: (mediaId: string, delta: -1 | 1) => void | Promise<void>;
  onRemove: (mediaId: string) => void | Promise<void>;
}) {
  return (
    <figure
      className={cn(
        'relative m-0 h-full overflow-hidden border bg-(--color-surface)',
        hero ? 'aspect-[4/3] border-(--color-accent)' : 'aspect-[4/3] border-(--color-divider)',
      )}
    >
      {photo.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.url}
          alt={photo.fileName ?? `Photo ${index + 1}`}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="grid h-full place-items-center text-[11px] ink-subtle">
          {photo.status === 'FAILED' ? 'Processing failed' : 'Processing…'}
        </div>
      )}

      {hero ? (
        <Plate size="marker" className="absolute left-[6px] top-[6px] z-[2]">
          MAIN PHOTO
        </Plate>
      ) : null}

      <figcaption className="absolute inset-x-0 bottom-0 z-[2] flex gap-1 bg-[rgba(13,16,23,0.75)] p-1">
        <button
          type="button"
          className="btn btn-secondary bg-transparent px-2 py-[2px] text-[11px] text-white"
          onClick={() => void onMove(photo.mediaId, -1)}
          disabled={index === 0}
          aria-label={`Move ${photo.fileName ?? 'photo'} earlier`}
        >
          ←
        </button>
        <button
          type="button"
          className="btn btn-secondary bg-transparent px-2 py-[2px] text-[11px] text-white"
          onClick={() => void onMove(photo.mediaId, 1)}
          disabled={index === total - 1}
          aria-label={`Move ${photo.fileName ?? 'photo'} later`}
        >
          →
        </button>
        <button
          type="button"
          className="btn btn-secondary ml-auto bg-transparent px-2 py-[2px] text-[11px] text-white"
          onClick={() => void onRemove(photo.mediaId)}
          aria-label={`Remove ${photo.fileName ?? 'photo'}`}
        >
          Remove
        </button>
      </figcaption>

      {photo.warnings.length > 0 ? (
        // Advisory only — never blocking (C14).
        <span className="absolute right-[6px] top-[6px] z-[2] bg-(--color-warn-bg) px-[5px] py-[1px] text-[10px] text-(--color-warn)">
          {photo.warnings.join(', ')}
        </span>
      ) : null}
    </figure>
  );
}

/**
 * An empty slot. Each is its own drop target so a dealer can drag the rear
 * three-quarter shot onto the rear three-quarter slot; the drop still appends
 * (order is changed by reordering, not by where the file landed), but the
 * affordance is what makes the seven-slot layout legible rather than decorative.
 */
function EmptySlot({
  label,
  hero = false,
  onPick,
  onDropFiles,
}: {
  label: string;
  hero?: boolean;
  onPick: () => void;
  onDropFiles: (files: FileList | File[]) => void | Promise<void>;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <button
      type="button"
      onClick={onPick}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void onDropFiles(event.dataTransfer.files);
      }}
      className={cn(
        'grid aspect-[4/3] h-full w-full place-items-center border border-dashed p-2 text-center',
        hero ? 'text-[13px]' : 'text-[11px]',
        dragging
          ? 'border-(--color-accent) bg-(--color-accent-100)'
          : 'border-(--color-divider) ink-muted',
      )}
    >
      <span>
        <span className={hero ? 'block font-medium' : 'block'}>{label}</span>
        <span className="text-(--color-accent)">
          {hero ? 'Drag a photo here, or browse' : 'Add'}
        </span>
      </span>
    </button>
  );
}

/**
 * Client-side pre-compression to a 2400px longest edge at q0.85 (§12.1). Also
 * the moment EXIF is dropped for the upload: canvas re-encoding keeps no
 * metadata, so a photo's GPS coordinates never leave the dealer's phone. The
 * server re-encodes and strips again — this is a courtesy, not the guarantee.
 */
async function compress(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    // No canvas: send the original rather than failing the upload outright.
    return { blob: file, width: bitmap.width, height: bitmap.height };
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  );

  return blob ? { blob, width, height } : { blob: file, width, height };
}

async function pollUntilReady(
  mediaId: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  for (let attempt = 0; attempt < POLL_LIMIT; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const response = await fetch(`/api/dealer/media/${mediaId}`);
    if (!response.ok) continue;

    const media = (await response.json()) as VehicleMediaDto;
    if (media.status === 'READY') {
      onProgress(100);
      return;
    }
    if (media.status === 'FAILED') throw new Error('That photo could not be processed.');

    onProgress(Math.min(96, 80 + attempt));
  }

  // Still processing: the photo exists and the grid will show it as soon as the
  // worker finishes, so this is not an upload failure.
  onProgress(100);
}
