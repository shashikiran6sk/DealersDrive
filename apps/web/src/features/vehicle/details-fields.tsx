'use client';

import type { CatalogBundle, DealerVehicleDto } from '@dealers-drive/contracts';

import { Combobox } from '@/components/forms/combobox';
import { Field } from '@/components/forms/field';

/**
 * DESIGN-SPEC §3.14 step 2 — Details.
 *
 * Eight required fields and two optional ones. The eight are the ones a buyer
 * filters on or a dealer is asked about on the phone, which is why they are
 * mandatory: a listing missing its RTO or its insurance status generates an
 * enquiry that exists only to ask for it.
 *
 * `seats` and `airbags` stay optional and say so. The distinction is not
 * cosmetic — it is the same split as `VEHICLE_WIZARD_STEPS.details.fields`, and
 * `UpdateVehicleInput` mirrors it by letting only those two be sent as `null`.
 */
export interface DetailsValue {
  kmDriven: string;
  ownerNumber: string;
  colorId: string;
  rtoCode: string;
  insuranceType: string;
  insuranceValidTill: string;
  cityId: string;
  regNumberMasked: string;
  seats: string;
  airbags: string;
  features: string;
}

export function detailsFrom(vehicle: DealerVehicleDto): DetailsValue {
  return {
    kmDriven: vehicle.kmDriven === null ? '' : String(vehicle.kmDriven),
    ownerNumber: vehicle.ownerNumber === null ? '' : String(vehicle.ownerNumber),
    colorId: vehicle.colorId ?? '',
    rtoCode: vehicle.rtoCode ?? '',
    insuranceType: vehicle.insuranceType ?? '',
    insuranceValidTill: vehicle.insuranceValidTill?.slice(0, 10) ?? '',
    cityId: vehicle.cityId ?? '',
    regNumberMasked: vehicle.regNumberMasked ?? '',
    seats: vehicle.seats === null ? '' : String(vehicle.seats),
    airbags: vehicle.airbags === null ? '' : String(vehicle.airbags),
    features: vehicle.features.join(', '),
  };
}

const REQUIRED: [keyof DetailsValue, string][] = [
  ['kmDriven', 'KMs driven'],
  ['ownerNumber', 'Number of owners'],
  ['colorId', 'Colour'],
  ['rtoCode', 'RTO'],
  ['insuranceType', 'Insurance'],
  ['insuranceValidTill', 'Insurance valid till'],
  ['cityId', 'Location'],
  ['regNumberMasked', 'Registration number'],
];

/**
 * The same eight fields the API requires, plus the format checks that turn a
 * 400 into an inline message. The server runs its own version regardless.
 */
export function validateDetails(value: DetailsValue): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const [key, label] of REQUIRED) {
    if (value[key].trim() === '') errors[key] = `${label} is required.`;
  }

  if (!errors.kmDriven) {
    const km = Number(value.kmDriven);
    if (!Number.isInteger(km) || km < 0 || km > 1_000_000) {
      errors.kmDriven = 'Enter the odometer reading in kilometres, up to 10,00,000.';
    }
  }

  if (!errors.regNumberMasked) {
    const plate = value.regNumberMasked
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '');
    if (!/^(?:[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}|\d{2}BH\d{4}[A-Z]{1,2})$/.test(plate)) {
      errors.regNumberMasked = 'Enter a registration number like TN 09 BX 1234.';
    }
  }

  if (!errors.insuranceValidTill && Number.isNaN(Date.parse(value.insuranceValidTill))) {
    errors.insuranceValidTill = 'Enter a valid date.';
  }

  return errors;
}

export function DetailsFields({
  catalog,
  value,
  onChange,
  errors,
  disabled = false,
}: {
  catalog: CatalogBundle;
  value: DetailsValue;
  onChange: (next: DetailsValue) => void;
  errors: Record<string, string>;
  disabled?: boolean;
}) {
  function set(patch: Partial<DetailsValue>) {
    onChange({ ...value, ...patch });
  }

  return (
    <>
      <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        <Field id="kmDriven" label="KMs driven" error={errors.kmDriven}>
          <input
            id="kmDriven"
            name="kmDriven"
            type="number"
            min={0}
            max={1_000_000}
            required
            className="input tnum"
            value={value.kmDriven}
            disabled={disabled}
            onChange={(event) => set({ kmDriven: event.target.value })}
          />
        </Field>

        <Field id="ownerNumber" label="Number of owners" error={errors.ownerNumber}>
          <select
            id="ownerNumber"
            name="ownerNumber"
            className="input"
            required
            value={value.ownerNumber}
            disabled={disabled}
            onChange={(event) => set({ ownerNumber: event.target.value })}
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
            required
            value={value.colorId}
            disabled={disabled}
            onChange={(event) => set({ colorId: event.target.value })}
          >
            <option value="">Select</option>
            {catalog.colors.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </Field>

        {/* A combobox: there are dozens of RTO codes and a dealer knows the one
            on the plate, so letting them type "TN 23" beats scrolling. */}
        <Combobox
          id="rtoCode"
          label="RTO"
          name="rtoCode"
          required
          disabled={disabled}
          error={errors.rtoCode}
          value={value.rtoCode}
          placeholder="Search RTO codes…"
          options={catalog.rto.map((entry) => ({
            value: entry.code,
            label: entry.code,
            hint: `${entry.name}, ${entry.state}`,
            keywords: `${entry.name} ${entry.city} ${entry.state}`,
          }))}
          onChange={(rtoCode) => set({ rtoCode })}
        />

        <Field id="insuranceType" label="Insurance" error={errors.insuranceType}>
          <select
            id="insuranceType"
            name="insuranceType"
            className="input"
            required
            value={value.insuranceType}
            disabled={disabled}
            onChange={(event) => set({ insuranceType: event.target.value })}
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
            required
            className="input tnum"
            value={value.insuranceValidTill}
            disabled={disabled}
            onChange={(event) => set({ insuranceValidTill: event.target.value })}
          />
        </Field>

        <Combobox
          id="cityId"
          label="Location"
          name="cityId"
          required
          disabled={disabled}
          error={errors.cityId}
          value={value.cityId}
          placeholder="Search cities…"
          options={catalog.cities.map((entry) => ({
            value: entry.id,
            label: entry.name,
            hint: entry.state,
            keywords: entry.state,
          }))}
          onChange={(cityId) => set({ cityId })}
        />

        <Field
          id="regNumberMasked"
          label="Registration number"
          hint="masked on the listing"
          error={errors.regNumberMasked}
        >
          <input
            id="regNumberMasked"
            name="regNumberMasked"
            required
            placeholder="TN 09 BX 1234"
            className="input font-mono uppercase"
            value={value.regNumberMasked}
            disabled={disabled}
            onChange={(event) => set({ regNumberMasked: event.target.value })}
          />
        </Field>

        <Field id="seats" label="Seats" hint="optional" error={errors.seats}>
          <input
            id="seats"
            name="seats"
            type="number"
            min={2}
            max={10}
            className="input tnum"
            value={value.seats}
            disabled={disabled}
            onChange={(event) => set({ seats: event.target.value })}
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
            value={value.airbags}
            disabled={disabled}
            onChange={(event) => set({ airbags: event.target.value })}
          />
        </Field>
      </div>

      <Field
        id="features"
        label="Features"
        hint="optional, comma separated"
        error={errors.features}
      >
        <input
          id="features"
          name="features"
          className="input"
          list="feature-suggestions"
          value={value.features}
          disabled={disabled}
          onChange={(event) => set({ features: event.target.value })}
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

/** Only the fields this step owns; an untouched step must not blank another's. */
export function detailsPatch(value: DetailsValue): Record<string, unknown> {
  const text = (raw: string): string | undefined => {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };
  const int = (raw: string): number | undefined => {
    const parsed = text(raw);
    return parsed === undefined ? undefined : Number(parsed);
  };

  const features = value.features
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const validTill = text(value.insuranceValidTill);

  return {
    ...maybe('kmDriven', int(value.kmDriven)),
    ...maybe('ownerNumber', int(value.ownerNumber)),
    ...maybe('colorId', text(value.colorId)),
    ...maybe('rtoCode', text(value.rtoCode)),
    ...maybe('insuranceType', text(value.insuranceType)),
    // `<input type="date">` gives a bare date; the contract wants an offset.
    ...maybe('insuranceValidTill', validTill ? `${validTill}T00:00:00.000Z` : undefined),
    ...maybe('cityId', text(value.cityId)),
    ...maybe('regNumberMasked', text(value.regNumberMasked)),
    // The two optional fields are the only ones that may be *cleared*, which is
    // why they send `null` where the others simply go unsent.
    seats: int(value.seats) ?? null,
    airbags: int(value.airbags) ?? null,
    features,
  };
}

function maybe<T>(key: string, value: T | undefined): Record<string, T> {
  return value === undefined ? {} : { [key]: value };
}
