'use client';

import { DealerSelfUpdateInput, type DealerProfile } from '@dealers-drive/contracts';
import { useActionState, useState } from 'react';

import { Field, invalidProps } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Banner } from '@/components/ui/primitives';
import { ServiceInput } from '@/components/ui/service-input';
import { saveDealerProfileAction } from '@/features/dealer/profile-actions';

import { LockedField } from './locked-field';
import { LockedNote } from './locked-note';
import { MapKindNote } from './map-kind-note';
import { EMPTY_FORM_STATE, MIN_YEAR, PROFILE_FORM_TEXT } from './profile-form.constants';
import { ReviewPanel } from './review-panel';
import { SaveRow } from './save-row';

export function DealerProfileForm({ dealer }: { dealer: DealerProfile }) {
  const [state, formAction] = useActionState(saveDealerProfileAction, EMPTY_FORM_STATE);
  const errors = state.fieldErrors;
  const [yearError, setYearError] = useState<string>();
  const establishedYearError = yearError ?? errors.establishedYear;

  const waiting = dealer.profileChange?.status === 'PENDING' ? dealer.profileChange : null;
  const taglineValue = waiting?.tagline ?? dealer.tagline ?? '';
  const servicesValue =
    waiting && waiting.specialities.length > 0 ? waiting.specialities : dealer.specialities;

  return (
    <form action={formAction} className="flex flex-col gap-[18px]">
      {state.status === 'saved' ? (
        <Banner tone="ok">
          {dealer.profileChange?.status === 'PENDING'
            ? PROFILE_FORM_TEXT.savedPending
            : PROFILE_FORM_TEXT.saved}
        </Banner>
      ) : null}
      {state.message ? <Banner tone="err">{state.message}</Banner> : null}

      <ReviewPanel change={dealer.profileChange} />

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">{PROFILE_FORM_TEXT.dealershipHeading}</h2>

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <LockedField
            id="legalName"
            label={PROFILE_FORM_TEXT.nameLabel}
            value={dealer.legalName}
          />

          <Field
            id="establishedYear"
            label={PROFILE_FORM_TEXT.establishedLabel}
            error={establishedYearError}
          >
            <Input
              id="establishedYear"
              name="establishedYear"
              type="number"
              min={MIN_YEAR}
              max={new Date().getFullYear()}
              className="tnum"
              defaultValue={dealer.establishedYear ?? ''}
              onChange={() => setYearError(undefined)}
              onInvalid={(event) => {
                event.preventDefault();
                const result = DealerSelfUpdateInput.safeParse({
                  establishedYear: event.currentTarget.valueAsNumber,
                });
                setYearError(result.error?.issues[0]?.message ?? PROFILE_FORM_TEXT.invalidYear);
              }}
              {...invalidProps('establishedYear', establishedYearError)}
            />
          </Field>
        </div>

        <Field
          id="tagline"
          label={PROFILE_FORM_TEXT.taglineLabel}
          hint={waiting ? PROFILE_FORM_TEXT.taglineHintWaiting : PROFILE_FORM_TEXT.taglineHint}
          error={errors.tagline}
        >
          <Input
            id="tagline"
            {...(waiting ? {} : { name: 'tagline' })}
            minLength={10}
            maxLength={200}
            defaultValue={taglineValue}
            placeholder={PROFILE_FORM_TEXT.taglinePlaceholder}
            required={!waiting}
            aria-required={waiting ? undefined : 'true'}
            disabled={Boolean(waiting)}
            {...invalidProps('tagline', errors.tagline)}
          />
        </Field>

        <Field
          id="specialities"
          label={PROFILE_FORM_TEXT.servicesLabel}
          hint={waiting ? PROFILE_FORM_TEXT.servicesHintWaiting : PROFILE_FORM_TEXT.servicesHint}
          error={errors.specialities}
        >
          <ServiceInput
            id="specialities"
            {...(waiting ? {} : { name: 'specialities' })}
            value={servicesValue}
            placeholder={PROFILE_FORM_TEXT.servicesPlaceholder}
            required={!waiting}
            disabled={Boolean(waiting)}
            {...invalidProps('specialities', errors.specialities)}
          />
        </Field>
      </section>

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">{PROFILE_FORM_TEXT.contactHeading}</h2>
        <LockedNote>{PROFILE_FORM_TEXT.contactNote}</LockedNote>

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <LockedField id="contactFullName" label="Contact name" value={dealer.contact.fullName} />
          <LockedField id="contactEmail" label="Email" value={dealer.contact.email} />
          <LockedField id="contactPhone" label="Mobile" value={dealer.contact.phoneDisplay} mono />
          <LockedField id="contactLandline" label="Landline" value={dealer.contact.landline} mono />
        </div>
      </section>

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">{PROFILE_FORM_TEXT.addressHeading}</h2>
        <LockedNote>{PROFILE_FORM_TEXT.addressNote}</LockedNote>

        <LockedField id="addressLine" label="Street address" value={dealer.address.line} />

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <LockedField id="addressCity" label="City" value={dealer.address.city} />
          <LockedField id="addressDistrict" label="District" value={dealer.address.district} />
          <LockedField id="addressState" label="State" value={dealer.address.state} />
          <LockedField id="addressPincode" label="Pincode" value={dealer.address.pincode} mono />
        </div>

        <LockedField
          id="addressMapsUrl"
          label="Google Maps location"
          value={dealer.address.mapsUrl}
        >
          <MapKindNote mapsUrl={dealer.address.mapsUrl} kind={dealer.address.mapKind} />
        </LockedField>
      </section>

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">{PROFILE_FORM_TEXT.taxHeading}</h2>
        <p className="text-[12px] ink-subtle">{PROFILE_FORM_TEXT.taxNote}</p>

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
