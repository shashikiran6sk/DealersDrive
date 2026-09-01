'use client';

import type { CatalogBundle, DealerVehicleDto } from '@dealers-drive/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Banner, Blueprint, Stepper, StatusTag } from '@/components/ui/primitives';
import { submitListingAction, updateVehicleAction } from '@/features/vehicle/actions';
import { BasicsFields, validateBasics, type BasicsValue } from '@/features/vehicle/basics-fields';
import {
  DetailsFields,
  detailsFrom,
  detailsPatch,
  validateDetails,
  type DetailsValue,
} from '@/features/vehicle/details-fields';
import { PhotoUploader } from '@/features/vehicle/photo-uploader';
import { WIZARD_STEPS, type WizardStep } from '@/features/vehicle/steps';

/**
 * DESIGN-SPEC §3.14 steps 1–4, and the edit screen for an existing vehicle.
 *
 * ## State is the draft row, not this component
 *
 * Every step writes through C8 before it moves, forwards **or backwards**, so
 * "Continue", "Back" and "Save draft" are the same PATCH with a different
 * destination. That is what makes the flow non-destructive: a dealer on Photos
 * can go back to Basics, change the variant, and come forward to find every
 * Detail they typed still there — because it was never being held in a
 * component that unmounted, it was in the database.
 *
 * ## Required fields are the server's ruling
 *
 * `Continue` is disabled by `vehicle.completeness.steps[step].complete`, which
 * the API computes from `VEHICLE_WIZARD_STEPS`. The local `validateBasics` /
 * `validateDetails` run first, but only to produce per-field messages — they
 * cannot make a step passable that the server considers incomplete, and
 * `submit()` refuses independently. Editing the DOM or PATCHing the API
 * directly therefore buys a draft that will not publish, not a shortcut.
 *
 * Nothing here sets a status. Publishing is `POST /submit`, an *event* the
 * state machine interprets, and the credit hold that goes with it happens in
 * the same transaction on the server (Rules 4 and 5).
 */
export function VehicleWizard({
  vehicle,
  catalog,
  step,
  minPhotos,
}: {
  vehicle: DealerVehicleDto;
  catalog: CatalogBundle;
  step: WizardStep;
  minPhotos: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isEditable = vehicle.status === 'DRAFT' || vehicle.status === 'READY';

  // Seeded from the saved row, so a remount after navigation restores exactly
  // what was written rather than an empty form.
  const [basics, setBasics] = useState<BasicsValue>({
    makeId: vehicle.makeId,
    modelId: vehicle.modelId,
    variantId: vehicle.variantId ?? '',
    year: String(vehicle.year),
    fuel: vehicle.fuel,
    transmission: vehicle.transmission,
    bodyType: vehicle.bodyType,
  });
  const [details, setDetails] = useState<DetailsValue>(() => detailsFrom(vehicle));
  const [price, setPrice] = useState({
    priceRupees: vehicle.pricePaise === null ? '' : String(vehicle.pricePaise / 100),
    priceNegotiable: vehicle.priceNegotiable,
    description: vehicle.description ?? '',
  });

  const stepState = vehicle.completeness.steps[step];

  function go(next: WizardStep) {
    router.push(`/dealer/vehicles/${vehicle.id}/edit?step=${next}`);
  }

  /** The fields the current step owns. Photos save themselves as they upload. */
  function patchForStep(): Record<string, unknown> {
    if (step === 0) {
      return {
        makeId: basics.makeId,
        modelId: basics.modelId,
        variantId: basics.variantId,
        year: Number(basics.year),
        fuel: basics.fuel,
        transmission: basics.transmission,
        bodyType: basics.bodyType,
      };
    }
    if (step === 1) return detailsPatch(details);
    if (step === 3) {
      return {
        ...(price.priceRupees.trim() === ''
          ? {}
          : { pricePaise: Math.round(Number(price.priceRupees) * 100) }),
        priceNegotiable: price.priceNegotiable,
        ...(price.description.trim() === '' ? {} : { description: price.description.trim() }),
      };
    }
    return {};
  }

  function localErrors(): Record<string, string> {
    if (step === 0) return validateBasics(basics);
    if (step === 1) return validateDetails(details);
    return {};
  }

  /**
   * Saves the current step, then runs `after` if the write succeeded.
   *
   * `enforce` distinguishes the two reasons to save. Moving *forward* must not
   * carry a gap past a mandatory step, so it validates first. Moving *backward*
   * and "Save draft" must save whatever exists — refusing to keep a half-filled
   * Details page because the dealer wants to correct the make on Basics would
   * throw away the very work this flow exists to preserve.
   */
  function save(options: { enforce: boolean; after?: () => void }) {
    setMessage(null);
    setSaved(false);

    if (options.enforce) {
      const invalid = localErrors();
      if (Object.keys(invalid).length > 0) {
        setErrors(invalid);
        setMessage('Every field on this page is required. Check the highlighted ones.');
        return;
      }
    }

    startTransition(async () => {
      const result = await updateVehicleAction(vehicle.id, patchForStep());

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message ?? 'We could not save those changes.');
        return;
      }

      // The server's verdict on this step, recomputed from what it just stored.
      // The local check above is for messages; this is the one that decides.
      const serverStep = result.data?.completeness.steps[step];
      if (options.enforce && serverStep && !serverStep.complete) {
        setErrors({});
        setMessage(
          `Still missing: ${serverStep.missing.join(', ')}. Fill these in before continuing.`,
        );
        router.refresh();
        return;
      }

      setErrors({});
      setSaved(true);
      router.refresh();
      options.after?.();
    });
  }

  function submitForApproval() {
    setMessage(null);
    startTransition(async () => {
      const result = await submitListingAction(vehicle.id);
      if (!result.ok) {
        setMessage(result.message ?? 'We could not submit that listing.');
        return;
      }
      router.push(`/dealer/vehicles/${vehicle.id}/edit?step=3&submitted=1`);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-[18px] p-[22px]">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[26px]">{vehicle.title}</h1>
        <StatusTag tone={vehicle.statusTone}>{vehicle.statusLabel}</StatusTag>
        <Link href="/dealer/inventory" className="btn btn-ghost ml-auto text-[12px]">
          Back to inventory
        </Link>
      </div>

      {vehicle.rejectionReason ? (
        <Banner tone="err" title="This listing was rejected">
          {vehicle.rejectionReason}
        </Banner>
      ) : null}
      {vehicle.changeRequestNote ? (
        <Banner tone="warn" title="Changes requested">
          {vehicle.changeRequestNote}
        </Banner>
      ) : null}

      <Stepper steps={WIZARD_STEPS} current={step} />

      {message ? <Banner tone="err">{message}</Banner> : null}
      {saved ? <Banner tone="ok">Saved.</Banner> : null}

      <form
        className="card gap-[16px] p-5"
        onSubmit={(event) => {
          event.preventDefault();
          save({ enforce: true, after: () => go(Math.min(3, step + 1) as WizardStep) });
        }}
      >
        {step === 0 ? (
          <>
            <div>
              <h2 className="text-[21px]">Vehicle basics</h2>
              <p className="mt-1 text-[13px] ink-muted">
                All seven are required. Changing them here keeps everything you have already entered
                on the later steps.
              </p>
            </div>
            <BasicsFields
              catalog={catalog}
              value={basics}
              onChange={(next) => {
                setBasics(next);
                setErrors({});
              }}
              errors={errors}
              disabled={!isEditable}
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div>
              <h2 className="text-[21px]">Vehicle details</h2>
              <p className="mt-1 text-[13px] ink-muted">
                Buyers filter hard on these, so every field here except seats, airbags and features
                is required. Accurate numbers get better enquiries.
              </p>
            </div>
            <DetailsFields
              catalog={catalog}
              value={details}
              onChange={(next) => {
                setDetails(next);
                setErrors({});
              }}
              errors={errors}
              disabled={!isEditable}
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div>
              <h2 className="text-[21px]">Photos</h2>
              <p className="mt-1 text-[13px] ink-muted">
                One main photo and up to six supporting shots of this actual car. The main photo is
                what buyers see in search results.
              </p>
            </div>
            <PhotoUploader vehicleId={vehicle.id} media={vehicle.media} minPhotos={minPhotos} />
          </>
        ) : null}

        {step === 3 ? (
          <PriceStep
            vehicle={vehicle}
            value={price}
            onChange={(next) => {
              setPrice(next);
              setErrors({});
            }}
            errors={errors}
            disabled={!isEditable}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-[9px] border-t border-(--color-divider) pt-4 max-[375px]:flex-col max-[375px]:items-stretch">
          {step > 0 ? (
            <Button
              variant="secondary"
              size="md"
              disabled={pending}
              // Saves on the way back, so nothing typed on this step is lost by
              // going to correct something on an earlier one.
              onClick={() => save({ enforce: false, after: () => go((step - 1) as WizardStep) })}
            >
              Back
            </Button>
          ) : null}

          <Button
            variant="secondary"
            size="md"
            className="ml-auto max-[375px]:ml-0"
            loading={pending}
            onClick={() => save({ enforce: false })}
          >
            Save draft
          </Button>

          {step < 3 ? (
            <Button type="submit" variant="primary" size="md" loading={pending}>
              Continue
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              loading={pending}
              disabled={!vehicle.completeness.canSubmit}
              onClick={submitForApproval}
            >
              Submit for approval
            </Button>
          )}
        </div>

        {/* What this step is still missing, straight from the API. Shown on
            every step rather than only at the end, because finding out on step
            4 that step 2 was incomplete is the failure this replaces. */}
        {stepState && !stepState.complete ? (
          <p className="text-[12px] text-(--color-warn)">
            Required on this page: {stepState.missing.join(', ')}.
          </p>
        ) : null}

        {step === 3 && !vehicle.completeness.canSubmit ? (
          <ul className="text-[12px] text-(--color-warn)">
            {vehicle.completeness.blockers.map((blocker) => (
              <li key={`${blocker.code}-${blocker.message}`}>• {blocker.message}</li>
            ))}
          </ul>
        ) : null}
      </form>
    </div>
  );
}

interface PriceValue {
  priceRupees: string;
  priceNegotiable: DealerVehicleDto['priceNegotiable'];
  description: string;
}

function PriceStep({
  vehicle,
  value,
  onChange,
  errors,
  disabled,
}: {
  vehicle: DealerVehicleDto;
  value: PriceValue;
  onChange: (next: PriceValue) => void;
  errors: Record<string, string>;
  disabled: boolean;
}) {
  return (
    <>
      <div>
        <h2 className="text-[21px]">Review &amp; submit</h2>
        <p className="mt-1 text-[13px] ink-muted">
          Submitting holds one credit. It is consumed when a reviewer approves the listing, and
          returned if they reject it.
        </p>
      </div>

      <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        <Field id="priceRupees" label="Asking price (₹)" error={errors.pricePaise}>
          <input
            id="priceRupees"
            name="priceRupees"
            type="number"
            min={10}
            step={1000}
            required
            className="input tnum"
            // Rupees on screen, paise on the wire. The conversion happens once,
            // at this boundary, and never in the other direction (Rule 3).
            value={value.priceRupees}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, priceRupees: event.target.value })}
          />
        </Field>

        <Field id="priceNegotiable" label="Negotiable" error={errors.priceNegotiable}>
          <select
            id="priceNegotiable"
            name="priceNegotiable"
            className="input"
            value={value.priceNegotiable}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...value,
                priceNegotiable: event.target.value as PriceValue['priceNegotiable'],
              })
            }
          >
            <option value="FIXED">Fixed price</option>
            <option value="SLIGHTLY">Slightly negotiable</option>
          </select>
        </Field>
      </div>

      <Field
        id="description"
        label="Description"
        hint="at least 100 characters — it is what makes this listing yours"
        error={errors.description}
      >
        <textarea
          id="description"
          name="description"
          className="input"
          rows={6}
          maxLength={4000}
          required
          value={value.description}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
        />
      </Field>

      <Blueprint className="bg-(--color-accent-100) p-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="font-heading text-[17px] font-semibold">{vehicle.title}</div>
            <div className="mt-1 text-[13px] ink-secondary tnum">
              {vehicle.priceLabel} · {vehicle.kmDriven?.toLocaleString('en-IN') ?? '—'} km ·{' '}
              {vehicle.fuel.toLowerCase()} · <span>{vehicle.photoCount} photos</span>
            </div>
          </div>
          <div className="text-right">
            <div className="eyebrow">Credits after publish</div>
            <div className="font-heading text-[28px] font-bold leading-none tnum">
              {vehicle.creditPreview.balanceAfterPublish}
            </div>
          </div>
        </div>
      </Blueprint>
    </>
  );
}
