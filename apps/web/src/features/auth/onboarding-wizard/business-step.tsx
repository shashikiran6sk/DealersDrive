'use client';

import type { DealerProfile } from '@dealers-drive/contracts';

import { Field, invalidProps } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { ServiceInput } from '@/components/ui/service-input';
import { servicesOf } from '@/lib/services';

import { ONBOARDING_TEXT, TAGLINE_MAX, TAGLINE_MIN } from './onboarding-wizard.constants';

export interface BusinessStepProps {
  dealer: DealerProfile | null;
  errors: Record<string, string>;
  hidden: boolean;
  values: Record<string, string>;
}

export function BusinessStep({ dealer, errors, hidden, values }: BusinessStepProps) {
  return (
    <fieldset hidden={hidden} className="m-0 border-0 p-0">
      <legend className="sr-only">{ONBOARDING_TEXT.businessLegend}</legend>

      <h1 className="font-heading text-[34px] font-semibold leading-[1.1] tracking-[-0.02em]">
        {ONBOARDING_TEXT.businessHeading}
      </h1>
      <p className="mb-[20px] mt-[8px] text-[15px] ink-secondary">
        {ONBOARDING_TEXT.businessIntro}
      </p>

      <div className="flex flex-col gap-[14px]">
        <Field
          id="legalName"
          label="Dealership name"
          hint="as registered — buyers see this"
          error={errors.legalName}
        >
          <input
            id="legalName"
            name="legalName"
            defaultValue={values.legalName ?? dealer?.legalName ?? ''}
            className="input"
            autoComplete="organization"
            required
            aria-required="true"
            {...invalidProps('legalName', errors.legalName)}
          />
        </Field>

        <Field id="addressLine" label="Address" error={errors.addressLine}>
          <input
            id="addressLine"
            name="addressLine"
            defaultValue={values.addressLine ?? dealer?.address.line ?? ''}
            className="input"
            autoComplete="street-address"
            required
            aria-required="true"
            {...invalidProps('addressLine', errors.addressLine)}
          />
        </Field>

        <div className="grid gap-[14px] sm:grid-cols-2">
          <Field id="city" label="City" error={errors.city}>
            <input
              id="city"
              name="city"
              defaultValue={values.city ?? dealer?.address.city ?? ''}
              className="input"
              autoComplete="address-level2"
              placeholder="Vellore"
              required
              aria-required="true"
              {...invalidProps('city', errors.city)}
            />
          </Field>

          <Field id="district" label="District" error={errors.district}>
            <input
              id="district"
              name="district"
              defaultValue={values.district ?? dealer?.address.district ?? ''}
              className="input"
              placeholder="Vellore"
              required
              aria-required="true"
              {...invalidProps('district', errors.district)}
            />
          </Field>

          <Field id="state" label="State" error={errors.state}>
            <input
              id="state"
              name="state"
              defaultValue={values.state ?? dealer?.address.state ?? ''}
              className="input"
              autoComplete="address-level1"
              placeholder="Tamil Nadu"
              required
              aria-required="true"
              {...invalidProps('state', errors.state)}
            />
          </Field>

          <Field id="pincode" label="Pincode" error={errors.pincode}>
            <input
              id="pincode"
              name="pincode"
              defaultValue={values.pincode ?? dealer?.address.pincode ?? ''}
              className="input tnum"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              required
              aria-required="true"
              {...invalidProps('pincode', errors.pincode)}
            />
          </Field>

          <Field
            id="mapsUrl"
            label="Google Maps location"
            hint="buyers use this for directions"
            error={errors.mapsUrl}
            className="sm:col-span-2"
          >
            <input
              id="mapsUrl"
              name="mapsUrl"
              type="text"
              inputMode="url"
              defaultValue={values.mapsUrl ?? dealer?.address.mapsUrl ?? ''}
              className="input"
              placeholder="https://maps.app.goo.gl/…"
              required
              aria-required="true"
              {...invalidProps('mapsUrl', errors.mapsUrl)}
            />
            <p className="mt-[4px] text-[11px] ink-subtle">
              Open your yard in Google Maps, tap <strong className="font-medium">Share</strong>,
              then <strong className="font-medium">Copy link</strong> and paste it here. The{' '}
              <strong className="font-medium">Embed a map</strong> code works too.
            </p>
          </Field>

          <Field id="landline" label="Landline" hint="optional" error={errors.landline}>
            <input
              id="landline"
              name="landline"
              defaultValue={values.landline ?? dealer?.contact.landline ?? ''}
              className="input tnum"
              autoComplete="tel"
              placeholder="0416 224 8890"
              {...invalidProps('landline', errors.landline)}
            />
          </Field>

          <Field
            id="tagline"
            label="One line about your dealership"
            hint="shown under your name on your public page"
            error={errors.tagline}
            className="sm:col-span-2"
          >
            <Input
              id="tagline"
              name="tagline"
              minLength={TAGLINE_MIN}
              maxLength={TAGLINE_MAX}
              defaultValue={values.tagline ?? dealer?.tagline ?? ''}
              placeholder={ONBOARDING_TEXT.taglinePlaceholder}
              required
              aria-required="true"
              {...invalidProps('tagline', errors.tagline)}
            />
            <p className="mt-[4px] text-[11px] ink-subtle">
              What you sell and what makes your yard worth the drive. One sentence — buyers read
              this before anything else on the page.
            </p>
          </Field>

          <Field
            id="specialities"
            label="Services you offer"
            hint="up to 12"
            error={errors.specialities}
            className="sm:col-span-2"
          >
            <ServiceInput
              id="specialities"
              name="specialities"
              value={
                values.specialities ? servicesOf(values.specialities) : (dealer?.specialities ?? [])
              }
              placeholder="In-house workshop"
              required
              {...invalidProps('specialities', errors.specialities)}
            />
            <p className="mt-[4px] text-[11px] ink-subtle">
              One at a time — type a service and press Add. Buyers see the first three on your
              directory card and all of them on your page: finance, exchange, RC transfer, in-house
              workshop, insurance.
            </p>
          </Field>
        </div>
      </div>
    </fieldset>
  );
}
