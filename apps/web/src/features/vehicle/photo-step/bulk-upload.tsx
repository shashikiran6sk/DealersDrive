'use client';

import {
  DEALER_PHOTOS_REQUIRED,
  IMAGE_MIME_TYPES,
  type DealerVehiclePhotos,
} from '@dealers-drive/contracts';
import { useId, useState } from 'react';

import { Banner } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { failureMessage } from '@/lib/upload';

import { BulkUploadRow } from './bulk-upload-row';
import { inCaptureOrder } from './capture-time';
import { PHOTO_STEP_TEXT } from './photo-step.constants';
import { photoCount, removePhoto, uploadPhoto } from './utils';

export interface BulkUploadProps {
  vehicleId: string;
  photos: DealerVehiclePhotos;
  onPhotos: (photos: DealerVehiclePhotos) => void;
  onUploadingChange?: (uploading: boolean) => void;
}

interface QueuedFile {
  id: string;
  file: File;
  status: 'waiting' | 'uploading' | 'failed';
  message: string | null;
}

export function BulkUpload({ vehicleId, photos, onPhotos, onUploadingChange }: BulkUploadProps) {
  const inputId = useId();
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploading = queue.some((item) => item.status !== 'failed');
  const editable = photos.canEdit && !uploading && removing === null;
  const count = photoCount(photos);
  const shots = photos.slots.filter((slot) => slot.photo !== null).length;
  const room = Math.max(0, photos.unsortedMax - photos.unsorted.length);

  function update(id: string, change: Partial<QueuedFile>): void {
    setQueue((items) => items.map((item) => (item.id === id ? { ...item, ...change } : item)));
  }

  async function send(items: readonly QueuedFile[]): Promise<void> {
    onUploadingChange?.(true);
    for (const item of items) {
      update(item.id, { status: 'uploading', message: null });
      try {
        onPhotos(await uploadPhoto(vehicleId, 'UNSORTED', item.file));
        setQueue((current) => current.filter((one) => one.id !== item.id));
      } catch (caught) {
        update(item.id, {
          status: 'failed',
          message: failureMessage(caught, PHOTO_STEP_TEXT.failed),
        });
      }
    }
    onUploadingChange?.(false);
  }

  async function choose(list: FileList | null): Promise<void> {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    const usable = files.filter((file) => IMAGE_MIME_TYPES.some((type) => type === file.type));
    const ordered = await inCaptureOrder(usable);
    const free = Math.max(0, room - queue.length);
    const taken = ordered.slice(0, free);
    const skipped = files.length - usable.length;
    const leftOut = ordered.length - taken.length;
    setError(null);
    setNotices([
      ...(skipped > 0 ? [PHOTO_STEP_TEXT.skippedType(skipped)] : []),
      ...(leftOut > 0 ? [PHOTO_STEP_TEXT.leftOut(leftOut, photos.unsortedMax)] : []),
    ]);
    const items = taken.map((file): QueuedFile => ({
      id: crypto.randomUUID(),
      file,
      status: 'waiting',
      message: null,
    }));
    setQueue((current) => [...current, ...items]);
    await send(items);
  }

  async function remove(mediaId: string): Promise<void> {
    setRemoving(mediaId);
    setError(null);
    try {
      onPhotos(await removePhoto(vehicleId, mediaId));
    } catch (caught) {
      setError(failureMessage(caught, PHOTO_STEP_TEXT.failed));
    } finally {
      setRemoving(null);
    }
  }

  const failed = queue.filter((item) => item.status === 'failed');
  const ready = count >= DEALER_PHOTOS_REQUIRED;

  return (
    <section className="card flex flex-col gap-[12px] p-[16px]">
      <div className="flex flex-col gap-1">
        <h3 className="text-[17px]">{PHOTO_STEP_TEXT.bulkTitle}</h3>
        <p className="max-w-[68ch] text-[13px] ink-body">{PHOTO_STEP_TEXT.bulkBody}</p>
      </div>
      {notices.map((notice) => (
        <Banner key={notice} tone="warn">
          {notice}
        </Banner>
      ))}
      {error ? <Banner tone="err">{error}</Banner> : null}
      <input
        id={inputId}
        type="file"
        multiple
        accept={IMAGE_MIME_TYPES.join(',')}
        className="sr-only"
        disabled={!editable || room - queue.length <= 0}
        aria-label={PHOTO_STEP_TEXT.bulkChoose}
        onChange={(event) => {
          const list = event.target.files;
          void choose(list).finally(() => {
            event.target.value = '';
          });
        }}
      />
      <label
        htmlFor={inputId}
        className="flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] border-2 border-dashed border-(--color-accent-400) bg-(--color-accent-100) p-[16px] text-center"
      >
        <span aria-hidden className="text-[28px] leading-none">
          +
        </span>
        <span className="text-[15px] font-semibold">{PHOTO_STEP_TEXT.bulkChoose}</span>
      </label>
      <p className="text-[13px] font-medium tnum" aria-live="polite">
        {ready
          ? PHOTO_STEP_TEXT.bulkReady(count)
          : PHOTO_STEP_TEXT.bulkCount(count, DEALER_PHOTOS_REQUIRED)}
        {shots > 0 ? ` ${PHOTO_STEP_TEXT.bulkShotsAlsoCount(shots)}` : null}
      </p>
      {photos.unsorted.length + queue.length > 0 ? (
        <ul
          aria-label={PHOTO_STEP_TEXT.bulkListLabel}
          className="flex flex-col divide-y divide-(--color-divider) border-y border-(--color-divider)"
        >
          {photos.unsorted.map((photo, index) => {
            const name = photo.fileName ?? PHOTO_STEP_TEXT.bulkUnnamed(index + 1);
            return (
              <BulkUploadRow
                key={photo.mediaId}
                name={name}
                status="uploaded"
                busy={!editable}
                onRemove={photos.canEdit ? () => void remove(photo.mediaId) : undefined}
              />
            );
          })}
          {queue.map((item) => (
            <BulkUploadRow
              key={item.id}
              name={item.file.name}
              status={item.status}
              message={item.message}
              onRemove={
                item.status === 'failed'
                  ? () => setQueue((current) => current.filter((one) => one.id !== item.id))
                  : undefined
              }
            />
          ))}
        </ul>
      ) : null}
      {failed.length > 0 && !uploading ? (
        <div>
          <Button variant="secondary" onClick={() => void send(failed)}>
            {PHOTO_STEP_TEXT.bulkRetry}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
