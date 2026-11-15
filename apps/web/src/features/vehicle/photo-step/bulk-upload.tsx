'use client';

import {
  IMAGE_MIME_TYPES,
  PHOTO_SLOT_LABELS,
  STANDARD_PHOTO_SLOTS,
  type DealerVehiclePhotos,
  type VehiclePhotoSlot,
} from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import { failureMessage } from '@/lib/upload';

import {
  EMPTY_ARRANGEMENT,
  arrange,
  localPhotos,
  stillMissing,
  swap,
  uploadQueue,
  without,
  type Arrangement,
  type ArrangementPosition,
  type LocalPhoto,
} from './arrangement';
import { BulkArrangement } from './bulk-arrangement';
import { inCaptureOrder } from './capture-time';
import { BULK_UPLOAD_ANCHOR, PHOTO_STEP_TEXT } from './photo-step.constants';
import { uploadPhoto } from './utils';

export interface BulkUploadProps {
  vehicleId: string;
  photos: DealerVehiclePhotos;
  nextHref: string;
  onPhotos: (photos: DealerVehiclePhotos) => void;
  onUploadingChange?: (uploading: boolean) => void;
}

function uploadedSlots(photos: DealerVehiclePhotos): Set<VehiclePhotoSlot> {
  return new Set(photos.slots.filter((one) => one.photo !== null).map((one) => one.slot));
}

function holds(arrangement: Arrangement, position: ArrangementPosition): boolean {
  return position.area === 'slot'
    ? (arrangement.slots[position.index] ?? null) !== null
    : position.index < arrangement.extras.length;
}

function toLocal(file: File): LocalPhoto {
  return { id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) };
}

function positionLabel(position: ArrangementPosition): string {
  const slot = position.area === 'slot' ? STANDARD_PHOTO_SLOTS[position.index] : undefined;
  return slot ? PHOTO_SLOT_LABELS[slot] : PHOTO_STEP_TEXT.arrangeExtras;
}

export function BulkUpload({
  vehicleId,
  photos,
  nextHref,
  onPhotos,
  onUploadingChange,
}: BulkUploadProps) {
  const router = useRouter();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [arrangement, setArrangement] = useState<Arrangement>(EMPTY_ARRANGEMENT);
  const [selected, setSelected] = useState<ArrangementPosition | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const previews = useRef(new Set<string>());

  useEffect(() => {
    const urls = previews.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  const uploaded = uploadedSlots(photos);
  const extrasRoom = Math.max(0, photos.extrasMax - photos.extras.length);
  const queued = uploadQueue(arrangement);
  const missing = stillMissing(arrangement, uploaded);
  const uploading = progress !== null;
  const editable = photos.canEdit && !uploading;

  function release(photo: LocalPhoto): void {
    URL.revokeObjectURL(photo.previewUrl);
    previews.current.delete(photo.previewUrl);
  }

  async function choose(list: FileList | null): Promise<void> {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    const usable = files.filter((file) => IMAGE_MIME_TYPES.some((type) => type === file.type));
    const ordered = (await inCaptureOrder(usable)).map(toLocal);
    for (const photo of ordered) previews.current.add(photo.previewUrl);
    const result = arrange(arrangement, ordered, uploaded, extrasRoom);
    for (const photo of result.leftOut) release(photo);
    setArrangement(result.arrangement);
    setSelected(null);
    setError(null);
    const skipped = files.length - usable.length;
    setNotices([
      ...(skipped > 0 ? [PHOTO_STEP_TEXT.skippedType(skipped)] : []),
      ...(result.leftOut.length > 0
        ? [PHOTO_STEP_TEXT.leftOut(result.leftOut.length, photos.extrasMax)]
        : []),
    ]);
  }

  function press(position: ArrangementPosition): void {
    if (selected === null) {
      if (holds(arrangement, position)) setSelected(position);
      return;
    }
    if (selected.area !== position.area || selected.index !== position.index) {
      setArrangement(swap(arrangement, selected, position));
    }
    setSelected(null);
  }

  function remove(id: string): void {
    const photo = localPhotos(arrangement).find((one) => one.id === id);
    if (photo) release(photo);
    setArrangement(without(arrangement, id));
    setSelected(null);
  }

  function startOver(): void {
    for (const photo of localPhotos(arrangement)) release(photo);
    setArrangement(EMPTY_ARRANGEMENT);
    setSelected(null);
    setNotices([]);
    setFailed(new Set());
    setError(null);
  }

  async function uploadAll(): Promise<void> {
    const queue = uploadQueue(arrangement);
    if (queue.length === 0) return;
    setSelected(null);
    setError(null);
    setNotices([]);
    setProgress({ done: 0, total: queue.length });
    onUploadingChange?.(true);
    let remaining = arrangement;
    let latest = photos;
    const failures = new Set<string>();
    let lastMessage: string | null = null;
    for (const [index, item] of queue.entries()) {
      try {
        latest = await uploadPhoto(vehicleId, item.slot, item.photo.file);
        onPhotos(latest);
        remaining = without(remaining, item.photo.id);
        release(item.photo);
        setArrangement(remaining);
      } catch (caught) {
        failures.add(item.photo.id);
        lastMessage = failureMessage(caught, PHOTO_STEP_TEXT.failed);
      }
      setProgress({ done: index + 1, total: queue.length });
    }
    setProgress(null);
    setFailed(failures);
    onUploadingChange?.(false);
    if (failures.size > 0) {
      setError(
        failures.size === queue.length && lastMessage
          ? lastMessage
          : PHOTO_STEP_TEXT.uploadFailedCount(failures.size),
      );
      return;
    }
    if (latest.missing.length === 0) router.push(nextHref);
  }

  const picker = (
    <input
      ref={input}
      id={inputId}
      type="file"
      multiple
      accept={IMAGE_MIME_TYPES.join(',')}
      className="sr-only"
      disabled={!editable}
      aria-label={PHOTO_STEP_TEXT.bulkChoose}
      onChange={(event) => {
        const list = event.target.files;
        void choose(list).finally(() => {
          event.target.value = '';
        });
      }}
    />
  );

  const alreadyIn = uploaded.size;
  const willComplete = missing.length === 0;

  if (queued.length === 0) {
    return (
      <section id={BULK_UPLOAD_ANCHOR} className="card flex flex-col gap-[12px] p-[16px]">
        <h3 className="text-[17px]">
          {alreadyIn === 10 ? PHOTO_STEP_TEXT.bulkDone : PHOTO_STEP_TEXT.bulkTitle}
        </h3>
        <p className="max-w-[68ch] text-[13px] ink-body">{PHOTO_STEP_TEXT.bulkBody}</p>
        {alreadyIn > 0 && alreadyIn < 10 ? (
          <p className="text-[13px] font-medium">{PHOTO_STEP_TEXT.bulkAlreadyIn(alreadyIn)}</p>
        ) : null}
        {notices.map((notice) => (
          <Banner key={notice} tone="warn">
            {notice}
          </Banner>
        ))}
        {error ? <Banner tone="err">{error}</Banner> : null}
        {picker}
        <label
          htmlFor={inputId}
          className="flex min-h-[132px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] border-2 border-dashed border-(--color-accent-400) bg-(--color-accent-100) p-[16px] text-center"
        >
          <span aria-hidden className="text-[30px] leading-none">
            +
          </span>
          <span className="text-[15px] font-semibold">{PHOTO_STEP_TEXT.bulkChoose}</span>
        </label>
        {alreadyIn > 0 ? (
          <BulkArrangement
            arrangement={arrangement}
            photos={photos}
            selected={null}
            failed={failed}
            disabled
            onPress={() => undefined}
            onRemove={() => undefined}
          />
        ) : null}
      </section>
    );
  }

  return (
    <section id={BULK_UPLOAD_ANCHOR} className="card flex flex-col gap-[12px] p-[16px]">
      <div className="flex flex-col gap-1">
        <h3 className="text-[17px]">{PHOTO_STEP_TEXT.arrangeTitle}</h3>
        <p className="max-w-[68ch] text-[13px] ink-body">{PHOTO_STEP_TEXT.arrangeBody}</p>
      </div>
      {notices.map((notice) => (
        <Banner key={notice} tone="warn">
          {notice}
        </Banner>
      ))}
      {error ? <Banner tone="err">{error}</Banner> : null}
      <p className="min-h-[18px] text-[13px] font-medium" aria-live="polite">
        {uploading
          ? PHOTO_STEP_TEXT.uploadingProgress(progress.done, progress.total)
          : selected
            ? PHOTO_STEP_TEXT.arrangeSelected(positionLabel(selected))
            : missing.length > 0
              ? PHOTO_STEP_TEXT.arrangeMissing(missing.map((slot) => PHOTO_SLOT_LABELS[slot]))
              : null}
      </p>
      <BulkArrangement
        arrangement={arrangement}
        photos={photos}
        selected={selected}
        failed={failed}
        disabled={!editable}
        onPress={press}
        onRemove={remove}
      />
      {picker}
      <div className="flex flex-wrap items-center gap-[9px] border-t border-(--color-divider) pt-[12px] max-[480px]:[&>*]:w-full">
        <Button variant="secondary" disabled={!editable} onClick={() => input.current?.click()}>
          {PHOTO_STEP_TEXT.addMore}
        </Button>
        <Button variant="ghost" disabled={!editable} onClick={startOver}>
          {PHOTO_STEP_TEXT.startOver}
        </Button>
        <Button
          variant="primary"
          className="ml-auto max-[480px]:ml-0"
          disabled={!editable}
          onClick={() => void uploadAll()}
        >
          {uploading
            ? PHOTO_STEP_TEXT.uploadingProgress(progress.done, progress.total)
            : willComplete
              ? PHOTO_STEP_TEXT.uploadAllAndContinue(queued.length)
              : PHOTO_STEP_TEXT.uploadAll(queued.length)}
        </Button>
      </div>
    </section>
  );
}
