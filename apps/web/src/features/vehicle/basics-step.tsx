'use client';

import type { CatalogBundle } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Banner, Stepper } from '@/components/ui/primitives';
import { createVehicleAction } from '@/features/vehicle/actions';
import { WIZARD_STEPS } from '@/features/vehicle/steps';

/**
 * DESIGN-SPEC §3.14 step 1 — Basics.
 *
 * Standing alone because C7 takes exactly these seven fields and answers with a
 * DRAFT that has an id. Everything after this point — details, photos, price —
 * is a PATCH against a real row, which is what makes "Save draft" and a
 * direct-to-storage uploader possible at all.
 *
 * Model narrows to the chosen make and variant to the chosen model, because a
 * flat list of every variant in the catalogue is unusable.
 */
export function BasicsStep({ catalog }: { catalog: CatalogBundle }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const [makeId, setMakeId] = useState('');
  const [modelId, setModelId] = useState('');
  const [variantId, setVariantId] = useState('');

  const make = useMemo(
    () => catalog.makes.find((entry) => entry.id === makeId),
    [catalog.makes, makeId],
  );
  const model = useMemo(
    () => make?.models.find((entry) => entry.id === modelId),
    [make, modelId],
  );
  const variant = useMemo(
    () => model?.variants.find((entry) => entry.id === variantId),
    [model, variantId],
  );

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear + 1 - 1990 }, (_, index) => thisYear + 1 - index);

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const year = formData.get('year');
      const result = await createVehicleAction({
        makeId,
        modelId,
        ...(variantId ? { variantId } : {}),
        year: typeof year === 'string' ? Number(year) : Number.NaN,
        fuel: formData.get('fuel'),
        transmission: formData.get('transmission'),
        bodyType: formData.get('bodyType'),
      });

      if (!result.ok || !result.data) {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message ?? 'We could not create that vehicle.');
        return;
      }
      router.push(`/dealer/vehicles/${result.data.id}/edit?step=1`);
    });
  }

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-[18px] p-[22px]">
      <h1 className="text-[26px]">Add a vehicle</h1>
      <Stepper steps={WIZARD_STEPS} current={0} />

      <form action={submit} className="card gap-[16px] p-5">
        <div>
          <h2 className="text-[21px]">Vehicle basics</h2>
          <p className="mt-1 text-[13px] ink-muted">
            These seven fields identify the car. You can change them until it goes to review.
          </p>
        </div>

        {message ? <Banner tone="err">{message}</Banner> : null}

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
          <Field id="makeId" label="Make" error={errors.makeId}>
            <select
              id="makeId"
              className="input"
              value={makeId}
              required
              onChange={(event) => {
                setMakeId(event.target.value);
                setModelId('');
                setVariantId('');
              }}
            >
              <option value="">Select a make</option>
              {catalog.makes.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </Field>

          <Field id="modelId" label="Model" error={errors.modelId}>
            <select
              id="modelId"
              className="input"
              value={modelId}
              required
              disabled={!make}
              onChange={(event) => {
                setModelId(event.target.value);
                setVariantId('');
              }}
            >
              <option value="">{make ? 'Select a model' : 'Choose a make first'}</option>
              {make?.models.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </Field>

          <Field id="variantId" label="Variant" hint="optional" error={errors.variantId}>
            <select
              id="variantId"
              className="input"
              value={variantId}
              disabled={!model}
              onChange={(event) => setVariantId(event.target.value)}
            >
              <option value="">{model ? 'No specific variant' : 'Choose a model first'}</option>
              {model?.variants.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </Field>

          <Field id="year" label="Year" error={errors.year}>
            <select
              id="year"
              name="year"
              className="input tnum"
              required
              defaultValue=""
              key={model?.id ?? 'no-model'}
            >
              <option value="">Select a year</option>
              {years
                .filter(
                  (year) =>
                    !model || (year >= model.yearFrom && year <= (model.yearTo ?? thisYear + 1)),
                )
                .map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
            </select>
          </Field>

          <Field id="fuel" label="Fuel" error={errors.fuel}>
            <select
              id="fuel"
              name="fuel"
              className="input"
              required
              // The catalogue knows this variant's fuel; pre-selecting it saves
              // a step and gets it right more often than the dealer would.
              key={`fuel-${variant?.id ?? 'none'}`}
              defaultValue={variant?.fuel ?? ''}
            >
              <option value="">Select a fuel</option>
              {catalog.fuels.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </Field>

          <Field id="transmission" label="Transmission" error={errors.transmission}>
            <select
              id="transmission"
              name="transmission"
              className="input"
              required
              key={`transmission-${variant?.id ?? 'none'}`}
              defaultValue={variant?.transmission ?? ''}
            >
              <option value="">Select a transmission</option>
              {catalog.transmissions.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </Field>

          <Field id="bodyType" label="Body type" error={errors.bodyType}>
            <select
              id="bodyType"
              name="bodyType"
              className="input"
              required
              key={`body-${model?.id ?? 'none'}`}
              defaultValue={model?.bodyType ?? ''}
            >
              <option value="">Select a body type</option>
              {catalog.bodyTypes.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap gap-[9px] border-t border-(--color-divider) pt-4 max-[375px]:flex-col">
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={pending}
            className="ml-auto max-[375px]:ml-0 max-[375px]:w-full"
          >
            Continue
          </Button>
        </div>
      </form>
    </div>
  );
}
