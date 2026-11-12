'use client';

import type { DealerVehiclePhotos, PhotoPlan, VehiclePhotoSlot } from '@dealers-drive/contracts';
import Link from 'next/link';
import { useState } from 'react';

import { ButtonLink } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import {
  PhotoWalkround,
  SHOT_GUIDES,
  PHOTO_STANDARD_TEXT,
} from '@/components/vehicle/photo-standard';
import { failureMessage } from '@/lib/upload';

import { ExtraPhotos } from './extra-photos';
import { PhotoPlanChoice } from './photo-plan-choice';
import { PHOTO_GUIDE_HREF, PHOTO_STEP_TEXT } from './photo-step.constants';
import type { PhotoStepProps } from './photo-step.types';
import { planOptions } from './plan-options';
import { ShotUploadCard } from './shot-upload-card';
import { choosePlan, removePhoto, uploadPhoto } from './utils';

export function PhotoStep({ vehicleId, photos: initial, backHref, nextHref }: PhotoStepProps) {
  const [photos, setPhotos] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

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

  const done = photos.slots.filter((slot) => slot.photo !== null).length;
  const doneNumbers = SHOT_GUIDES.filter((shot) =>
    photos.slots.some((slot) => slot.slot === shot.slot && slot.photo),
  ).map((shot) => shot.number);

  return (
    <div className="flex flex-col gap-[18px]">
      <p className="max-w-[68ch] text-[14px] ink-body">{PHOTO_STEP_TEXT.intro}</p>
      {error?.key === 'plan' ? <Banner tone="err">{error.message}</Banner> : null}
      {photos.canEdit ? null : <Banner tone="warn">{PHOTO_STEP_TEXT.locked}</Banner>}

      <PhotoPlanChoice
        options={planOptions(photos)}
        selected={photos.plan}
        disabled={!photos.canEdit || busy !== null}
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
          <section className="card grid gap-[16px] p-[16px] md:grid-cols-[200px_1fr]">
            <PhotoWalkround done={doneNumbers} className="h-auto w-full max-w-[220px]" />
            <div className="flex flex-col gap-2">
              <h3 className="text-[17px]">{PHOTO_STEP_TEXT.guideTitle}</h3>
              <p className="text-[13px] ink-body">{PHOTO_STANDARD_TEXT.intro}</p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] ink-body">
                {PHOTO_STANDARD_TEXT.tips.slice(0, 4).map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
              <Link
                href={PHOTO_GUIDE_HREF}
                target="_blank"
                className="text-[13px] font-medium underline"
              >
                {PHOTO_STEP_TEXT.guideLink}
              </Link>
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
          </section>

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
