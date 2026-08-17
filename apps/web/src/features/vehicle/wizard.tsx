'use client';

import type { CatalogBundle, DealerVehicleDto } from '@dealers-drive/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Banner, Blueprint, Stepper, StatusTag } from '@/components/ui/primitives';
import { submitListingAction, updateVehicleAction } from '@/features/vehicle/actions';
import { PhotoUploader } from '@/features/vehicle/photo-uploader';
import { WIZARD_STEPS, type WizardStep } from '@/features/vehicle/steps';

/**
 * DESIGN-SPEC §3.14 steps 2–4, and the edit screen for an existing vehicle.
 *
 * Every step saves through C8 before advancing, so "Continue" and "Save draft"
 * are the same write with a different destination — a dealer interrupted at
 * step 3 comes back to everything they typed.
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

  function go(next: WizardStep) {
    router.push(`/dealer/vehicles/${vehicle.id}/edit?step=${next}`);
  }

  /** Saves the current step, then runs `after` if the write succeeded. */
  function save(formData: FormData, after?: () => void) {
    setMessage(null);
    setSaved(false);

    startTransition(async () => {
      const patch = step === 1 ? detailsPatch(formData) : step === 3 ? pricePatch(formData) : {};
      const result = await updateVehicleAction(vehicle.id, patch);

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message ?? 'We could not save those changes.');
        return;
      }

      setErrors({});
      setSaved(true);
      router.refresh();
      after?.();
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
        action={(formData) => save(formData, () => go(Math.min(3, step + 1) as WizardStep))}
      >
        {step === 0 ? <BasicsSummary vehicle={vehicle} catalog={catalog} /> : null}
        {step === 1 ? (
          <DetailsStep vehicle={vehicle} catalog={catalog} errors={errors} disabled={!isEditable} />
        ) : null}
        {step === 2 ? (
          <>
            <div>
              <h2 className="text-[21px]">Photos</h2>
              <p className="mt-1 text-[13px] ink-muted">
                At least <span className="tnum">{minPhotos}</span> photographs of this actual car.
                The first one is what buyers see in search results.
              </p>
            </div>
            <PhotoUploader vehicleId={vehicle.id} media={vehicle.media} minPhotos={minPhotos} />
          </>
        ) : null}
        {step === 3 ? (
          <PriceStep vehicle={vehicle} errors={errors} disabled={!isEditable} />
        ) : null}

        <div className="flex flex-wrap items-center gap-[9px] border-t border-(--color-divider) pt-4 max-[375px]:flex-col max-[375px]:items-stretch">
          {step > 0 ? (
            <Button
              variant="secondary"
              size="md"
              disabled={pending}
              onClick={() => go((step - 1) as WizardStep)}
            >
              Back
            </Button>
          ) : null}

          <Button
            variant="secondary"
            size="md"
            className="ml-auto max-[375px]:ml-0"
            loading={pending}
            onClick={(event) => {
              const form = event.currentTarget.form;
              if (form) save(new FormData(form));
            }}
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

        {step === 3 && !vehicle.completeness.canSubmit ? (
          <ul className="text-[12px] text-(--color-warn)">
            {vehicle.completeness.blockers.map((blocker) => (
              <li key={blocker.code}>• {blocker.message}</li>
            ))}
          </ul>
        ) : null}
      </form>
    </div>
  );
}

/** Step 1 is read-only here — it was filled in on the way in, and C8 can change it. */
function BasicsSummary({
  vehicle,
  catalog,
}: {
  vehicle: DealerVehicleDto;
  catalog: CatalogBundle;
}) {
  const make = catalog.makes.find((entry) => entry.id === vehicle.makeId);
  const model = make?.models.find((entry) => entry.id === vehicle.modelId);

  const rows: [string, string][] = [
    ['Make', make?.name ?? '—'],
    ['Model', model?.name ?? '—'],
    ['Variant', model?.variants.find((v) => v.id === vehicle.variantId)?.name ?? '—'],
    ['Year', String(vehicle.year)],
    ['Fuel', label(catalog.fuels, vehicle.fuel)],
    ['Transmission', label(catalog.transmissions, vehicle.transmission)],
    ['Body type', label(catalog.bodyTypes, vehicle.bodyType)],
  ];

  return (
    <>
      <h2 className="text-[21px]">Vehicle basics</h2>
      <dl className="border border-(--color-divider)">
        {rows.map(([key, value]) => (
          <div
            key={key}
            className="flex justify-between gap-4 border-b border-(--color-divider) px-[14px] py-[10px] text-[13px] last:border-b-0"
          >
            <dt className="ink-muted">{key}</dt>
            <dd className="font-medium tnum">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function DetailsStep({
  vehicle,
  catalog,
  errors,
  disabled,
}: {
  vehicle: DealerVehicleDto;
  catalog: CatalogBundle;
  errors: Record<string, string>;
  disabled: boolean;
}) {
  return (
    <>
      <div>
        <h2 className="text-[21px]">Vehicle details</h2>
        <p className="mt-1 text-[13px] ink-muted">
          Buyers filter hard on these. Accurate numbers get better enquiries.
        </p>
      </div>

      <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        <Field id="kmDriven" label="KM driven" error={errors.kmDriven}>
          <input
            id="kmDriven"
            name="kmDriven"
            type="number"
            min={0}
            max={1_000_000}
            className="input tnum"
            defaultValue={vehicle.kmDriven ?? ''}
            disabled={disabled}
          />
        </Field>

        <Field id="ownerNumber" label="Owners" error={errors.ownerNumber}>
          <select
            id="ownerNumber"
            name="ownerNumber"
            className="input"
            defaultValue={vehicle.ownerNumber ?? ''}
            disabled={disabled}
          >
            <option value="">Select</option>
            {catalog.owners.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="colorId" label="Colour" error={errors.colorId}>
          <select
            id="colorId"
            name="colorId"
            className="input"
            defaultValue={vehicle.colorId ?? ''}
            disabled={disabled}
          >
            <option value="">Select</option>
            {catalog.colors.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </Field>

        <Field id="rtoCode" label="Registration (RTO)" error={errors.rtoCode}>
          <select
            id="rtoCode"
            name="rtoCode"
            className="input font-mono"
            defaultValue={vehicle.rtoCode ?? ''}
            disabled={disabled}
          >
            <option value="">Select</option>
            {catalog.rto.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.code} · {entry.name}
              </option>
            ))}
          </select>
        </Field>

        <Field id="insuranceType" label="Insurance" error={errors.insuranceType}>
          <select
            id="insuranceType"
            name="insuranceType"
            className="input"
            defaultValue={vehicle.insuranceType ?? ''}
            disabled={disabled}
          >
            <option value="">Select</option>
            {catalog.insuranceTypes.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="insuranceValidTill"
          label="Insurance valid till"
          error={errors.insuranceValidTill}
        >
          <input
            id="insuranceValidTill"
            name="insuranceValidTill"
            type="date"
            className="input tnum"
            defaultValue={vehicle.insuranceValidTill?.slice(0, 10) ?? ''}
            disabled={disabled}
          />
        </Field>

        <Field id="cityId" label="Location" error={errors.cityId}>
          <select
            id="cityId"
            name="cityId"
            className="input"
            defaultValue={vehicle.cityId ?? ''}
            disabled={disabled}
          >
            <option value="">Select</option>
            {catalog.cities.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}, {entry.state}
              </option>
            ))}
          </select>
        </Field>

        <Field id="seats" label="Seats" hint="optional" error={errors.seats}>
          <input
            id="seats"
            name="seats"
            type="number"
            min={2}
            max={10}
            className="input tnum"
            defaultValue={vehicle.seats ?? ''}
            disabled={disabled}
          />
        </Field>

        <Field id="airbags" label="Airbags" hint="optional" error={errors.airbags}>
          <input
            id="airbags"
            name="airbags"
            type="number"
            min={0}
            max={12}
            className="input tnum"
            defaultValue={vehicle.airbags ?? ''}
            disabled={disabled}
          />
        </Field>

        <Field
          id="regNumberMasked"
          label="Registration number"
          hint="masked on the listing"
          error={errors.regNumberMasked}
        >
          <input
            id="regNumberMasked"
            name="regNumberMasked"
            className="input font-mono"
            defaultValue={vehicle.regNumberMasked ?? ''}
            disabled={disabled}
          />
        </Field>
      </div>

      <Field id="features" label="Features" hint="comma separated" error={errors.features}>
        <input
          id="features"
          name="features"
          className="input"
          list="feature-suggestions"
          defaultValue={vehicle.features.join(', ')}
          disabled={disabled}
        />
      </Field>
      <datalist id="feature-suggestions">
        {catalog.features.map((feature) => (
          <option key={feature} value={feature} />
        ))}
      </datalist>
    </>
  );
}

function PriceStep({
  vehicle,
  errors,
  disabled,
}: {
  vehicle: DealerVehicleDto;
  errors: Record<string, string>;
  disabled: boolean;
}) {
  return (
    <>
      <div>
        <h2 className="text-[21px]">Price &amp; review</h2>
        <p className="mt-1 text-[13px] ink-muted">
          Submitting holds one credit. It is consumed when a reviewer approves the listing, and
          returned if they reject it.
        </p>
      </div>

      <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        <Field id="priceRupees" label="Asking price (₹)" error={errors.pricePaise}>
          <input
            id="priceRupees"
            name="priceRupees"
            type="number"
            min={10}
            step={1000}
            className="input tnum"
            // Rupees on screen, paise on the wire. The conversion happens once,
            // at this boundary, and never in the other direction (Rule 3).
            defaultValue={vehicle.pricePaise === null ? '' : vehicle.pricePaise / 100}
            disabled={disabled}
          />
        </Field>

        <Field id="priceNegotiable" label="Negotiable" error={errors.priceNegotiable}>
          <select
            id="priceNegotiable"
            name="priceNegotiable"
            className="input"
            defaultValue={vehicle.priceNegotiable}
            disabled={disabled}
          >
            <option value="FIXED">Fixed price</option>
            <option value="SLIGHTLY">Slightly negotiable</option>
            <option value="NEGOTIABLE">Negotiable</option>
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
          defaultValue={vehicle.description ?? ''}
          disabled={disabled}
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

/** Only the fields this step owns; an untouched step must not blank another's. */
function detailsPatch(formData: FormData): Record<string, unknown> {
  const text = (key: string): string | undefined => {
    const value = formData.get(key);
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };
  const int = (key: string): number | undefined => {
    const value = text(key);
    return value === undefined ? undefined : Number(value);
  };

  const features = (text('features') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const validTill = text('insuranceValidTill');

  return {
    ...maybe('kmDriven', int('kmDriven')),
    ...maybe('ownerNumber', int('ownerNumber')),
    ...maybe('colorId', text('colorId')),
    ...maybe('seats', int('seats')),
    ...maybe('airbags', int('airbags')),
    ...maybe('rtoCode', text('rtoCode')),
    ...maybe('cityId', text('cityId')),
    ...maybe('regNumberMasked', text('regNumberMasked')),
    ...maybe('insuranceType', text('insuranceType')),
    // `<input type="date">` gives a bare date; the contract wants an offset.
    ...maybe('insuranceValidTill', validTill ? `${validTill}T00:00:00.000Z` : undefined),
    ...(features.length > 0 ? { features } : {}),
  };
}

function pricePatch(formData: FormData): Record<string, unknown> {
  const rupees = formData.get('priceRupees');
  const negotiable = formData.get('priceNegotiable');
  const description = formData.get('description');

  return {
    ...(typeof rupees === 'string' && rupees.trim().length > 0
      ? { pricePaise: Math.round(Number(rupees) * 100) }
      : {}),
    ...(typeof negotiable === 'string' && negotiable ? { priceNegotiable: negotiable } : {}),
    ...(typeof description === 'string' && description.trim().length > 0
      ? { description: description.trim() }
      : {}),
  };
}

function maybe<T>(key: string, value: T | undefined): Record<string, T> {
  return value === undefined ? {} : { [key]: value };
}

function label(options: { value: string; label: string }[], value: string): string {
  return options.find((entry) => entry.value === value)?.label ?? value;
}
