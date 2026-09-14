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

/**
 * The dealer's own record (C1/C2) — the same answers onboarding collected, after
 * onboarding is over.
 *
 * **Three boxes, and a page of read-only facts (R27).** The dealer may change
 * when they started trading, the line they describe themselves in, and what
 * their yard does. Everything else is `disabled` and carries no `name`, so the
 * browser sends nothing for it — and `DealerSelfUpdateInput` would refuse it if
 * it did. Two defences for one rule, deliberately.
 *
 * The split is between *preferences* and *evidence*. The three editable answers
 * are opinions a dealership is entitled to revise. The locked ones are what the
 * platform checked: the registered name KYC was run against and the slug derives
 * from; the address, town, pin and map link the yard photograph and address
 * proof were *about*; the mobile and email a buyer reaches a vouched-for
 * business on; the GSTIN and PAN read off a document.
 *
 * A dealership that has genuinely moved does not edit its way to the new
 * address: it closes this account and opens another. That is heavier than an
 * edit box and it is correct — the VERIFIED plate is a claim about a place, and
 * there is no honest way to carry it across a move.
 *
 * **No "Trading name"**: `brandName` is the server-written mirror of
 * `legalName`, and two boxes able to disagree is what its absence prevents.
 */
export function DealerProfileForm({ dealer }: { dealer: DealerProfile }) {
  const [state, formAction] = useActionState(saveDealerProfileAction, EMPTY_FORM_STATE);
  const errors = state.fieldErrors;
  const [yearError, setYearError] = useState<string>();
  const establishedYearError = yearError ?? errors.establishedYear;

  /*
   * While a change waits, the two boxes are **shut** and show the proposed text
   * (**R34**). The dealer has already said what they want; the question is no
   * longer "what should this say" but "do I stand by this". Leaving the boxes
   * live offers an edit the API refuses with a 409 — worse than locking them and
   * worse than silently merging, because the dealer types a sentence and is then
   * told they could not have. The way to change it is `Cancel` in `ReviewPanel`.
   *
   * A REJECTED change locks nothing and is *not* put back in the box: the point
   * is to write something different, and restoring the refused text invites the
   * dealer to press Save again unchanged.
   */
  const waiting = dealer.profileChange?.status === 'PENDING' ? dealer.profileChange : null;
  const taglineValue = waiting?.tagline ?? dealer.tagline ?? '';
  const servicesValue =
    waiting && waiting.specialities.length > 0 ? waiting.specialities : dealer.specialities;

  return (
    <form action={formAction} className="flex flex-col gap-[18px]">
      {/*
        R34 — what "saved" means now, and it is not "published". A bare "Your
        profile has been saved" would be read as "your page has changed" by a
        dealer who then looks at their page and finds it has not.
      */}
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
          {/* R27 — the registered name is what KYC was checked against and what
              the public slug and URL derive from. */}
          <LockedField
            id="legalName"
            label={PROFILE_FORM_TEXT.nameLabel}
            value={dealer.legalName}
          />

          {/* Still theirs: a fact about the business that no verification rests
              on, and one that never becomes a different dealership. */}
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
          {/*
            `disabled` **and** no `name` while a change waits — the R27 shape, and
            load-bearing for the same reason: a locked box cannot reach
            `saveDealerProfileAction` even by accident, so a save in this state
            carries the established year and nothing else.
          */}
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

        {/*
          Required too (**R26**), and for the reason the tagline is: the first
          three are on the directory card and all of them are on the portfolio,
          which makes this the only structured thing a buyer can compare two
          dealerships by.
        */}
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
          {/*
            R27 reverses R7. The number stopped being a credential when dealers
            moved to Google sign-in, which was right about identity and wrong
            about what the field is for: it is the number printed on a verified
            dealership's public page, and a self-service edit re-points every
            listing at a phone nobody checked.
          */}
          <LockedField id="contactPhone" label="Mobile" value={dealer.contact.phoneDisplay} mono />
          <LockedField id="contactLandline" label="Landline" value={dealer.contact.landline} mono />
        </div>
      </section>

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">{PROFILE_FORM_TEXT.addressHeading}</h2>
        {/*
          R27, and the heaviest of the three locks. The yard photograph, the
          address proof and the verification visit were all about *this* place. A
          dealership that edits its way to another one is a different business
          wearing a plate granted to the first, so there is no edit box and no
          request queue either.
        */}
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
