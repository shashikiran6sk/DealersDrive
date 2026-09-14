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

export function BusinessStep({
  dealer,
  errors,
  hidden,
  values,
}: BusinessStepProps) {
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
        {/*
          One name, not two. The baseline asked for a public brand name and a
          registered legal name side by side, and dealers filled both in with the
          same words — twice the typing for a distinction that never held. The
          registered name is the one KYC is checked against, so it is the one
          asked for, and it is what buyers see.
        */}
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
          {/*
            City and state, typed.

            Both were a dropdown and a disabled box beside it, filled in from a
            five-row table: choose one of five towns, and the state is whatever
            the table says. A dealer in Salem could not finish this form, and
            one in Bengaluru could not be described by it. Two text fields
            instead — the server normalises case and spacing so one town does
            not become three, and the duplicate-name check below is what the
            city is really load-bearing for.
          */}
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

          {/*
            The district, beside the city rather than instead of it.

            It is the unit support and moderation actually work in — "every
            dealer in Vellore district" is a question the admin console can now
            answer, and "every dealer whose town is spelt Vellore" is not the
            same question. Free text like its two neighbours, and normalised by
            the same server-side function, so one district cannot arrive as
            three filter values.
          */}
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

          {/*
            Where the yard is, rather than what its address resolves to.

            A typed address is not a location — "18, Gandhi Road" is four
            different pins in one district, and the buyer who follows the wrong
            one has already driven there. The dealer knows which pin is their
            gate, and this is the shortest way for them to say so. It spans both
            columns because a share link is longer than a pincode, and the
            instruction under it is there because "paste a Maps link" is obvious
            only to somebody who has done it before.
          */}
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
              // `text`, not `url`: Share → Embed copies an `<iframe …>`, which
              // the server accepts and unwraps (R13), and which native URL
              // validation would refuse before the form is ever submitted.
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

          {/*
            The one line the public pages run under the dealership's name, asked
            for at the one moment a dealer is already describing their business —
            a separate profile screen later is one most of them never open.

            It replaces a four-row `About your dealership` textarea (**R26**),
            which got either a paragraph nobody read or twenty characters of "we
            sell used cars": prose is what a person filling in a sign-up form at
            the end of a working day is least able to produce. Nothing public
            renders the paragraph any more (R25).
          */}
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

          {/*
            What the yard actually does, as a set of short labels — the only
            structured thing on the public pages a buyer can compare two
            dealerships by. A platform where most rows are empty is one where
            that comparison does not exist, so it is asked for here rather than
            left to the profile screen. Repeats are merged on read (R18).
          */}
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
