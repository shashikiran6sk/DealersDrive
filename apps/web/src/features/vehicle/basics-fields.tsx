'use client';

import type { CatalogBundle, ModelVariantsResponse } from '@dealers-drive/contracts';
import { useEffect, useMemo, useState } from 'react';

import { Combobox } from '@/components/forms/combobox';
import { Field } from '@/components/forms/field';

/**
 * The seven Basics fields, shared by "Add a vehicle" (which POSTs them) and by
 * wizard step 1 (which PATCHes them).
 *
 * Both screens ask for exactly the same thing, and the wizard's version used to
 * be a read-only summary — so a dealer who picked the wrong variant had to
 * delete the draft and start again. Sharing the fields is what makes step 1
 * editable without a second, divergent copy of the dependent-selection logic.
 *
 * **All seven are mandatory.** The form cannot be submitted with a gap, and the
 * API refuses the same seven independently (`VEHICLE_WIZARD_STEPS`), so the
 * requirement does not rest on this component behaving.
 */
export interface BasicsValue {
  makeId: string;
  modelId: string;
  variantId: string;
  year: string;
  fuel: string;
  transmission: string;
  bodyType: string;
}

export const EMPTY_BASICS: BasicsValue = {
  makeId: '',
  modelId: '',
  variantId: '',
  year: '',
  fuel: '',
  transmission: '',
  bodyType: '',
};

const LABELS: Record<keyof BasicsValue, string> = {
  makeId: 'Make',
  modelId: 'Model',
  variantId: 'Variant',
  year: 'Year',
  fuel: 'Fuel',
  transmission: 'Transmission',
  bodyType: 'Body type',
};

/** Client-side mirror of the server's Basics step. Same seven fields. */
export function validateBasics(value: BasicsValue): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of Object.keys(LABELS) as (keyof BasicsValue)[]) {
    if (value[key].trim() === '') errors[key] = `${LABELS[key]} is required.`;
  }
  return errors;
}

export function BasicsFields({
  catalog,
  value,
  onChange,
  errors,
  disabled = false,
}: {
  catalog: CatalogBundle;
  value: BasicsValue;
  onChange: (next: BasicsValue) => void;
  errors: Record<string, string>;
  disabled?: boolean;
}) {
  const [variants, setVariants] = useState<ModelVariantsResponse | null>(null);
  const [loadingVariants, setLoadingVariants] = useState(false);

  const make = useMemo(
    () => catalog.makes.find((entry) => entry.id === value.makeId) ?? null,
    [catalog.makes, value.makeId],
  );
  const model = useMemo(
    () => make?.models.find((entry) => entry.id === value.modelId) ?? null,
    [make, value.modelId],
  );

  /**
   * Variants arrive per model rather than in the bundle — 2,000 of them is not
   * something to ship on the chance one gets used (`CatalogBundle`).
   *
   * The abort matters: a dealer clicking through three models in a second would
   * otherwise race three responses, and the slowest would win and repopulate
   * the list for a model they are no longer on.
   */
  useEffect(() => {
    if (!value.modelId) {
      setVariants(null);
      return;
    }

    const controller = new AbortController();
    setLoadingVariants(true);

    fetch(`/api/catalog/models/${value.modelId}/variants`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ModelVariantsResponse | null) => setVariants(data))
      .catch(() => {
        /* aborted, or the network blinked — the field simply stays empty. */
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingVariants(false);
      });

    return () => controller.abort();
  }, [value.modelId]);

  const selectedVariant = useMemo(
    () => variants?.data.find((entry) => entry.id === value.variantId) ?? null,
    [variants, value.variantId],
  );

  /**
   * The catalogue knows this variant's fuel and gearbox and this model's body
   * type. Pre-filling them is not a shortcut — it gets them right more often
   * than the dealer does — but it only ever fills a field the dealer has left
   * empty, so an explicit choice is never overwritten.
   */
  useEffect(() => {
    if (!selectedVariant) return;
    const patch: Partial<BasicsValue> = {};
    if (value.fuel === '') patch.fuel = selectedVariant.fuel;
    if (value.transmission === '') patch.transmission = selectedVariant.transmission;
    if (Object.keys(patch).length > 0) onChange({ ...value, ...patch });
    // `value` is deliberately absent: this must run when the variant changes,
    // not on every keystroke that produces a new `value` object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariant]);

  useEffect(() => {
    if (model && value.bodyType === '') onChange({ ...value, bodyType: model.bodyType });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  const thisYear = new Date().getFullYear();
  const years = useMemo(() => {
    // Bounded by the model's production run: a 2012 Fronx does not exist, and
    // offering it invites a listing nobody can search for correctly.
    const first = model ? Math.max(1990, model.yearFrom) : 1990;
    const last = model ? Math.min(thisYear + 1, model.yearTo ?? thisYear + 1) : thisYear + 1;
    const span: number[] = [];
    for (let year = last; year >= first; year -= 1) span.push(year);
    return span;
  }, [model, thisYear]);

  function set(patch: Partial<BasicsValue>) {
    onChange({ ...value, ...patch });
  }

  return (
    <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
      <Combobox
        id="makeId"
        label="Make"
        name="makeId"
        required
        disabled={disabled}
        error={errors.makeId}
        value={value.makeId}
        placeholder="Search makes…"
        options={catalog.makes.map((entry) => ({
          value: entry.id,
          label: entry.name,
          hint: `${entry.models.length} models`,
        }))}
        // Changing the make invalidates everything downstream. Clearing is the
        // honest move: keeping a Creta selected under Maruti Suzuki would be a
        // coherence error the API rejects anyway (§10.6).
        onChange={(makeId) => set({ makeId, modelId: '', variantId: '', year: '', bodyType: '' })}
      />

      <Combobox
        id="modelId"
        label="Model"
        name="modelId"
        required
        disabled={disabled || !make}
        disabledLabel="Choose a make first"
        error={errors.modelId}
        value={value.modelId}
        placeholder="Search models…"
        options={(make?.models ?? []).map((entry) => ({
          value: entry.id,
          label: entry.name,
          hint: `${entry.yearFrom}–${entry.yearTo ?? 'present'} · ${entry.variantCount} variants`,
          keywords: String(entry.yearFrom),
        }))}
        onChange={(modelId) => set({ modelId, variantId: '', year: '', bodyType: '' })}
      />

      <Combobox
        id="variantId"
        label="Variant"
        name="variantId"
        required
        disabled={disabled || !model}
        disabledLabel={model ? 'Loading variants…' : 'Choose a model first'}
        error={errors.variantId}
        value={value.variantId}
        placeholder={loadingVariants ? 'Loading…' : 'Search variants…'}
        emptyLabel={loadingVariants ? 'Loading…' : 'No matching variant.'}
        options={(variants?.data ?? []).map((entry) => ({
          value: entry.id,
          label: entry.name,
          hint: entry.label.split(' · ').slice(1).join(' · '),
          keywords: entry.label,
        }))}
        onChange={(variantId) => set({ variantId })}
      />

      <Field id="year" label="Year" error={errors.year}>
        <select
          id="year"
          name="year"
          className="input tnum"
          required
          disabled={disabled || !model}
          value={value.year}
          onChange={(event) => set({ year: event.target.value })}
        >
          <option value="">{model ? 'Select a year' : 'Choose a model first'}</option>
          {years.map((year) => (
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
          disabled={disabled}
          value={value.fuel}
          onChange={(event) => set({ fuel: event.target.value })}
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
          disabled={disabled}
          value={value.transmission}
          onChange={(event) => set({ transmission: event.target.value })}
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
          disabled={disabled}
          value={value.bodyType}
          onChange={(event) => set({ bodyType: event.target.value })}
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
  );
}
