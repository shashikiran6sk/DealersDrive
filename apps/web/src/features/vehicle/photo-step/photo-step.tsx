'use client';

import type { DealerVehiclePhotos, PhotoPlan, VehiclePhotoSlot } from '@dealers-drive/contracts';
import Link from 'next/link';
import { useState } from 'react';

import { ButtonLink } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import {
  BeforeYouShoot,
  GuideDownloadLink,
  GuideWalkround,
  SHOT_GUIDES,
} from '@/components/vehicle/photo-standard';
import { failureMessage } from '@/lib/upload';

import { BulkUpload } from './bulk-upload';
import { ExtraPhotos } from './extra-photos';
import { PhotoPlanChoice } from './photo-plan-choice';
import { PHOTO_GUIDE_HREF, PHOTO_STEP_TEXT } from './photo-step.constants';
import type { PhotoStepProps, UploadMode } from './photo-step.types';
import { planOptions } from './plan-options';
import { ShotProgress } from './shot-progress';
import { ShotUploadCard } from './shot-upload-card';
import { UploadModeSwitch } from './upload-mode-switch';
import { choosePlan, photosNeeded, removePhoto, uploadPhoto } from './utils';

export function PhotoStep({ vehicleId, photos: initial, backHref, nextHref }: PhotoStepProps) {
  const [photos, setPhotos] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [mode, setMode] = useState<UploadMode>(
    initial.slots.some((slot) => slot.photo !== null) && initial.unsorted.length === 0
      ? 'one'
      : 'all',
  );
  const [bulkUploading, setBulkUploading] = useState(false);

  async function run(key: string, work: () => Promise<DealerVehiclePhotos>): Promise<void> {
    setBusy(key);
    setError(null);
    try {
      setPhotos(await work());
    } catch (caught) {
      setError({ key, message: failureMessage(caught, PHOTO_STEP_TEXT.failed) });
    } finally {
      setBusy(null);
    }
  }

  const choose = (plan: PhotoPlan) => void run('plan', () => choosePlan(vehicleId, plan));
  const upload = (slot: VehiclePhotoSlot, file: File) =>
    void run(slot, () => uploadPhoto(vehicleId, slot, file));
  const remove = (mediaId: string) => void run(mediaId, () => removePhoto(vehicleId, mediaId));

  const bulk = mode === 'all' && photos.canEdit;
  const done = 10 - photosNeeded(photos);
  const doneSlots = new Set(
    photos.slots.filter((slot) => slot.photo !== null).map((slot) => slot.slot),
  );

  const guide = (
    <section className="card flex flex-col gap-[14px] p-[16px]">
      <div className="grid gap-[16px] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <GuideWalkround />
        <div className="flex flex-col gap-2">
          <h3 className="text-[19px]">{PHOTO_STEP_TEXT.guideTitle}</h3>
          <p className="text-[13px] ink-body">{PHOTO_STEP_TEXT.guideBody}</p>
          <div className="flex flex-wrap items-center gap-2">
            <GuideDownloadLink />
            <Link
              href={PHOTO_GUIDE_HREF}
              target="_blank"
              className="text-[13px] font-medium underline"
            >
              {PHOTO_STEP_TEXT.guideLink}
            </Link>
          </div>
          <div className="mt-auto pt-2">
            <div className="h-[8px] overflow-hidden rounded-full bg-(--color-accent-200)">
              <div
                className="h-full rounded-full bg-(--color-ok) transition-[width]"
                style={{ width: `${String(done * 10)}%` }}
              />
            </div>
            <p className="mt-1 text-[12px] font-medium tnum" aria-live="polite">
              {done === 10 ? PHOTO_STEP_TEXT.progressDone : PHOTO_STEP_TEXT.progress(done)}
            </p>
          </div>
        </div>
      </div>
      {bulk ? null : <ShotProgress done={doneSlots} />}
      <details open={done === 0 && !bulk} className="border-t border-(--color-divider) pt-3">
        <summary className="cursor-pointer text-[14px] font-semibold">
          {PHOTO_STEP_TEXT.beforeYouShoot}
        </summary>
        <div className="pt-3">
          <BeforeYouShoot />
        </div>
      </details>
    </section>
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <p className="max-w-[68ch] text-[14px] ink-body">{PHOTO_STEP_TEXT.intro}</p>
      {error?.key === 'plan' ? <Banner tone="err">{error.message}</Banner> : null}
      {photos.canEdit ? null : <Banner tone="warn">{PHOTO_STEP_TEXT.locked}</Banner>}

      <PhotoPlanChoice
        options={planOptions(photos)}
        selected={photos.plan}
        disabled={!photos.canEdit || busy !== null || bulkUploading}
        onChoose={choose}
      />

      {photos.plan === 'DEALERS_DRIVE' ? (
        <section className="card flex flex-col gap-2 p-[16px]">
          <h3 className="text-[16px]">{PHOTO_STEP_TEXT.studioNextTitle}</h3>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px] ink-body">
            {PHOTO_STEP_TEXT.studioNext.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {photos.plan === 'DEALER' ? (
        <>
          {photos.canEdit ? (
            <UploadModeSwitch
              mode={mode}
              disabled={busy !== null || bulkUploading}
              onChange={setMode}
            />
          ) : null}

          {bulk ? (
            <>
              <BulkUpload
                vehicleId={vehicleId}
                photos={photos}
                onPhotos={setPhotos}
                onUploadingChange={setBulkUploading}
              />
              {guide}
            </>
          ) : (
            <>
              {guide}
              {photos.unsorted.length > 0 ? (
                <p className="text-[13px] font-medium">
                  {PHOTO_STEP_TEXT.unsortedKept(photos.unsorted.length)}
                </p>
              ) : null}
              <ol className="flex flex-col gap-[12px]">
                {SHOT_GUIDES.map((shot) => (
                  <ShotUploadCard
                    key={shot.slot}
                    shot={shot}
                    photo={photos.slots.find((slot) => slot.slot === shot.slot)?.photo ?? null}
                    busy={busy === shot.slot}
                    editable={photos.canEdit && busy === null}
                    error={error?.key === shot.slot ? error.message : null}
                    onFile={(file) => upload(shot.slot, file)}
                  />
                ))}
              </ol>

              <ExtraPhotos
                extras={photos.extras}
                max={photos.extrasMax}
                busyKey={busy}
                editable={photos.canEdit && busy === null}
                onAdd={(file) => upload('EXTRA', file)}
                onRemove={remove}
              />
              {error &&
              (error.key === 'EXTRA' || photos.extras.some((one) => one.mediaId === error.key)) ? (
                <Banner tone="err">{error.message}</Banner>
              ) : null}
            </>
          )}
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-[9px] border-t border-(--color-divider) pt-[16px] max-[480px]:[&>*]:w-full">
        <ButtonLink href={backHref} variant="secondary">
          {PHOTO_STEP_TEXT.back}
        </ButtonLink>
        <ButtonLink href={nextHref} variant="primary" className="ml-auto max-[480px]:ml-0">
          {PHOTO_STEP_TEXT.continue}
        </ButtonLink>
      </div>
    </div>
  );
}
