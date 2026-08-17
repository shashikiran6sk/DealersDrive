'use client';

import type { DealerProfile } from '@dealers-drive/contracts';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Field, invalidProps } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import { saveDealerProfileAction, type ProfileFormState } from '@/features/dealer/profile-actions';

const EMPTY: ProfileFormState = { status: 'idle', fieldErrors: {} };

/**
 * The dealer's own record (C1/C2).
 *
 * Read-only here on purpose: `status`, `slug`, `creditBalance`, GSTIN and PAN.
 * The first three are the platform's to set; the tax identifiers were verified
 * during onboarding and changing them silently would invalidate that check —
 * `UpdateDealerInput` accepts them, but a support-reviewed change is the right
 * path and there is no endpoint here that shortcuts it.
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
          <Field id="brandName" label="Trading name" error={errors.brandName}>
            <input
              id="brandName"
              name="brandName"
              className="input"
              defaultValue={dealer.brandName}
              required
              {...invalidProps('brandName', errors.brandName)}
            />
          </Field>

          <Field id="legalName" label="Registered legal name" error={errors.legalName}>
            <input
              id="legalName"
              name="legalName"
              className="input"
              defaultValue={dealer.legalName}
              {...invalidProps('legalName', errors.legalName)}
            />
          </Field>

          <Field id="establishedYear" label="Established" error={errors.establishedYear}>
            <input
              id="establishedYear"
              name="establishedYear"
              type="number"
              min={1900}
              max={2100}
              className="input tnum"
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
          <input
            id="tagline"
            name="tagline"
            className="input"
            maxLength={200}
            defaultValue={dealer.tagline ?? ''}
            {...invalidProps('tagline', errors.tagline)}
          />
        </Field>

        <Field id="about" label="About the dealership" error={errors.about}>
          <textarea
            id="about"
            name="about"
            className="input"
            rows={6}
            maxLength={4000}
            defaultValue={dealer.about ?? ''}
            {...invalidProps('about', errors.about)}
          />
        </Field>

        <Field
          id="specialities"
          label="Services"
          hint="comma separated, up to 12"
          error={errors.specialities}
        >
          <input
            id="specialities"
            name="specialities"
            className="input"
            defaultValue={dealer.specialities.join(', ')}
            {...invalidProps('specialities', errors.specialities)}
          />
        </Field>
      </section>

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">Contact</h2>

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <Field id="contactFullName" label="Contact name" error={errors.contactFullName}>
            <input
              id="contactFullName"
              name="contactFullName"
              className="input"
              defaultValue={dealer.contact.fullName ?? ''}
              {...invalidProps('contactFullName', errors.contactFullName)}
            />
          </Field>

          <Field id="contactRoleTitle" label="Role" error={errors.contactRoleTitle}>
            <input
              id="contactRoleTitle"
              name="contactRoleTitle"
              className="input"
              defaultValue={dealer.contact.roleTitle ?? ''}
              {...invalidProps('contactRoleTitle', errors.contactRoleTitle)}
            />
          </Field>

          <Field id="contactEmail" label="Email" error={errors.contactEmail}>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              className="input"
              defaultValue={dealer.contact.email ?? ''}
              {...invalidProps('contactEmail', errors.contactEmail)}
            />
          </Field>

          <Field id="contactLandline" label="Landline" error={errors.contactLandline}>
            <input
              id="contactLandline"
              name="contactLandline"
              className="input tnum"
              defaultValue={dealer.contact.landline ?? ''}
              {...invalidProps('contactLandline', errors.contactLandline)}
            />
          </Field>

          <Field id="contactPhone" label="Mobile" hint="verified — contact support to change">
            <input
              id="contactPhone"
              className="input tnum"
              defaultValue={dealer.contact.phoneDisplay}
              disabled
            />
          </Field>
        </div>
      </section>

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">Address</h2>

        <Field id="addressLine" label="Street address" error={errors.addressLine}>
          <input
            id="addressLine"
            name="addressLine"
            className="input"
            defaultValue={dealer.address.line ?? ''}
            {...invalidProps('addressLine', errors.addressLine)}
          />
        </Field>

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <Field id="addressCity" label="City" hint="set during onboarding">
            <input
              id="addressCity"
              className="input"
              defaultValue={dealer.address.city ?? ''}
              disabled
            />
          </Field>

          <Field id="addressState" label="State" error={errors.addressState}>
            <input
              id="addressState"
              name="addressState"
              className="input"
              defaultValue={dealer.address.state ?? ''}
              {...invalidProps('addressState', errors.addressState)}
            />
          </Field>

          <Field id="addressPincode" label="Pincode" error={errors.addressPincode}>
            <input
              id="addressPincode"
              name="addressPincode"
              className="input tnum"
              inputMode="numeric"
              pattern="\d{6}"
              defaultValue={dealer.address.pincode ?? ''}
              {...invalidProps('addressPincode', errors.addressPincode)}
            />
          </Field>
        </div>
      </section>

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">Tax identifiers</h2>
        <p className="text-[12px] ink-subtle">
          Verified during onboarding. Contact support to change either — a silent edit would
          invalidate the verification your buyers rely on.
        </p>

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <Field id="gstin" label="GSTIN">
            <input
              id="gstin"
              className="input font-mono"
              defaultValue={dealer.gstin ?? ''}
              disabled
            />
          </Field>
          <Field id="pan" label="PAN">
            <input id="pan" className="input font-mono" defaultValue={dealer.pan ?? ''} disabled />
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
