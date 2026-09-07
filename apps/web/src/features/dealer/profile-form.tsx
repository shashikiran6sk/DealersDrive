'use client';

import type { DealerProfile } from '@dealers-drive/contracts';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Field, invalidProps } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Banner } from '@/components/ui/primitives';
import { saveDealerProfileAction, type ProfileFormState } from '@/features/dealer/profile-actions';

const EMPTY: ProfileFormState = { status: 'idle', fieldErrors: {} };

/**
 * The dealer's own record (C1/C2) — the same answers onboarding collected,
 * after onboarding is over.
 *
 * Read-only here on purpose: `status`, `slug`, `creditBalance`, GSTIN and PAN.
 * The first three are the platform's to set; the tax identifiers were verified
 * against a document during onboarding, and a silent edit would invalidate that
 * check. `UpdateDealerInput` accepts them — the *admin* review screen writes
 * them, with the certificate in hand — and there is deliberately no shortcut
 * here that skips that pair of eyes.
 *
 * ── Divergences from the baseline, each forced by a decision since ──────────
 *   · **No "Trading name".** `brandName` is the server-written mirror of
 *     `legalName` and is absent from `UpdateDealerInput`; two boxes able to
 *     disagree is the thing that removal prevents.
 *   · **City, district and state are typed, and editable** (D6, R2). They were
 *     a disabled box filled in from a five-row `cities` table.
 *   · **The Maps link is here** (R6) — the public portfolio's only source for
 *     "Get directions".
 *   · **The mobile is editable again** (R7). It was the login identity when
 *     dealers signed in with a number; identity is a Google account now, and
 *     what this field holds is the number a *buyer* is given.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function DealerProfileForm({ dealer }: { dealer: DealerProfile }) {
  const [state, formAction] = useActionState(saveDealerProfileAction, EMPTY);
  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="flex flex-col gap-[18px]">
      {state.status === 'saved' ? <Banner tone="ok">Your profile has been saved.</Banner> : null}
      {state.message ? <Banner tone="err">{state.message}</Banner> : null}

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">Dealership</h2>

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <Field
            id="legalName"
            label="Dealership name"
            hint="as buyers see it"
            error={errors.legalName}
          >
            <Input
              id="legalName"
              name="legalName"
              defaultValue={dealer.legalName}
              required
              aria-required="true"
              {...invalidProps('legalName', errors.legalName)}
            />
          </Field>

          <Field id="establishedYear" label="Established" error={errors.establishedYear}>
            <Input
              id="establishedYear"
              name="establishedYear"
              type="number"
              min={1900}
              max={2100}
              className="tnum"
              defaultValue={dealer.establishedYear ?? ''}
              {...invalidProps('establishedYear', errors.establishedYear)}
            />
          </Field>
        </div>

        <Field
          id="tagline"
          label="Tagline"
          hint="one line, shown on your directory card"
          error={errors.tagline}
        >
          <Input
            id="tagline"
            name="tagline"
            maxLength={200}
            defaultValue={dealer.tagline ?? ''}
            {...invalidProps('tagline', errors.tagline)}
          />
        </Field>

        {/*
          The paragraph the public portfolio runs under the yard photograph.
          Onboarding insists on twenty characters, and so does this box — a
          dealer must not be able to delete on the profile screen what the
          sign-up form would not let them skip.
        */}
        <Field
          id="about"
          label="About the dealership"
          hint="a sentence or two, shown on your public page"
          error={errors.about}
        >
          <Textarea
            id="about"
            name="about"
            rows={6}
            minLength={20}
            maxLength={4000}
            defaultValue={dealer.about ?? ''}
            {...invalidProps('about', errors.about)}
          />
        </Field>

        <Field
          id="specialities"
          label="Services"
          hint="comma separated, up to 12 — repeats are merged"
          error={errors.specialities}
        >
          <Input
            id="specialities"
            name="specialities"
            defaultValue={dealer.specialities.join(', ')}
            {...invalidProps('specialities', errors.specialities)}
          />
        </Field>
      </section>

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">Contact</h2>

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <Field id="contactFullName" label="Contact name" error={errors.contactFullName}>
            <Input
              id="contactFullName"
              name="contactFullName"
              defaultValue={dealer.contact.fullName ?? ''}
              {...invalidProps('contactFullName', errors.contactFullName)}
            />
          </Field>

          <Field id="contactRoleTitle" label="Role" error={errors.contactRoleTitle}>
            <Input
              id="contactRoleTitle"
              name="contactRoleTitle"
              defaultValue={dealer.contact.roleTitle ?? ''}
              {...invalidProps('contactRoleTitle', errors.contactRoleTitle)}
            />
          </Field>

          <Field id="contactEmail" label="Email" error={errors.contactEmail}>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={dealer.contact.email ?? ''}
              {...invalidProps('contactEmail', errors.contactEmail)}
            />
          </Field>

          {/*
            R7 — editable, and raw rather than formatted, because
            `+91 98400 12345` is what a dealer reads and `9840012345` is what
            the field accepts back. It stays unique across users, so swapping to
            a number that belongs to someone else is refused by the API and
            lands on this box.
          */}
          <Field
            id="contactPhone"
            label="Mobile"
            hint="the number buyers are given"
            error={errors.contactPhone}
          >
            <Input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              className="tnum"
              defaultValue={dealer.contact.phone}
              {...invalidProps('contactPhone', errors.contactPhone)}
            />
          </Field>

          <Field
            id="contactLandline"
            label="Landline"
            hint="optional"
            error={errors.contactLandline}
          >
            <Input
              id="contactLandline"
              name="contactLandline"
              className="tnum"
              defaultValue={dealer.contact.landline ?? ''}
              {...invalidProps('contactLandline', errors.contactLandline)}
            />
          </Field>
        </div>
      </section>

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">Address</h2>

        <Field id="addressLine" label="Street address" error={errors.addressLine}>
          <Input
            id="addressLine"
            name="addressLine"
            autoComplete="street-address"
            defaultValue={dealer.address.line ?? ''}
            {...invalidProps('addressLine', errors.addressLine)}
          />
        </Field>

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          {/*
            City, district and state are three text boxes rather than a dropdown
            and two disabled mirrors of it (D6, R2). The server normalises case
            and spacing on write, so one town does not become three facet
            values — and the name-within-a-city uniqueness check is what the
            city is really load-bearing for, which is why a refusal here names
            this box.
          */}
          <Field id="addressCity" label="City" error={errors.addressCity}>
            <Input
              id="addressCity"
              name="addressCity"
              autoComplete="address-level2"
              placeholder="Vellore"
              defaultValue={dealer.address.city ?? ''}
              {...invalidProps('addressCity', errors.addressCity)}
            />
          </Field>

          <Field id="addressDistrict" label="District" error={errors.addressDistrict}>
            <Input
              id="addressDistrict"
              name="addressDistrict"
              placeholder="Vellore"
              defaultValue={dealer.address.district ?? ''}
              {...invalidProps('addressDistrict', errors.addressDistrict)}
            />
          </Field>

          <Field id="addressState" label="State" error={errors.addressState}>
            <Input
              id="addressState"
              name="addressState"
              autoComplete="address-level1"
              placeholder="Tamil Nadu"
              defaultValue={dealer.address.state ?? ''}
              {...invalidProps('addressState', errors.addressState)}
            />
          </Field>

          <Field id="addressPincode" label="Pincode" error={errors.addressPincode}>
            <Input
              id="addressPincode"
              name="addressPincode"
              className="tnum"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              defaultValue={dealer.address.pincode ?? ''}
              {...invalidProps('addressPincode', errors.addressPincode)}
            />
          </Field>
        </div>

        {/*
          R6 — the pin, not the address. A typed street address is several
          different gates in one district, and the buyer who follows the wrong
          one has already driven there. Nullable on rows that predate the
          question, which is why the portfolio branches rather than composing a
          Maps URL out of the address.
        */}
        <Field
          id="addressMapsUrl"
          label="Google Maps location"
          hint="buyers use this for directions"
          error={errors.addressMapsUrl}
        >
          {/*
            `text`, not `url`, and that is deliberate. The Share panel's other
            half — Embed — copies a whole `<iframe …>` element to the clipboard,
            and the server now accepts one and keeps the link out of it (R13).
            `type="url"` would have the browser refuse that paste before the
            form is ever submitted, with a message no dealer can act on.
            `inputMode` still asks a phone for the URL keyboard.
          */}
          <Input
            id="addressMapsUrl"
            name="addressMapsUrl"
            type="text"
            inputMode="url"
            placeholder="https://maps.app.goo.gl/…"
            defaultValue={dealer.address.mapsUrl ?? ''}
            {...invalidProps('addressMapsUrl', errors.addressMapsUrl)}
          />
          <p className="mt-[4px] text-[11px] ink-subtle">
            Open your yard in Google Maps, tap <strong className="font-medium">Share</strong>, then{' '}
            <strong className="font-medium">Copy link</strong> and paste it here. The{' '}
            <strong className="font-medium">Embed a map</strong> code works too.
          </p>
        </Field>
      </section>

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">Tax identifiers</h2>
        <p className="text-[12px] ink-subtle">
          Verified during onboarding. Contact support to change either — a silent edit would
          invalidate the verification your buyers rely on.
        </p>

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <Field id="gstin" label="GSTIN">
            <Input id="gstin" className="font-mono" defaultValue={dealer.gstin ?? ''} disabled />
          </Field>
          <Field id="pan" label="PAN">
            <Input id="pan" className="font-mono" defaultValue={dealer.pan ?? ''} disabled />
          </Field>
        </div>
      </section>

      <SaveRow />
    </form>
  );
}

function SaveRow() {
  const { pending } = useFormStatus();

  return (
    <div className="flex items-center gap-3">
      <Button type="submit" variant="primary" size="md" loading={pending} className="min-w-[160px]">
        Save changes
      </Button>
      <span className="text-[12px] ink-subtle">
        Changes appear on your public dealership page immediately.
      </span>
    </div>
  );
}
