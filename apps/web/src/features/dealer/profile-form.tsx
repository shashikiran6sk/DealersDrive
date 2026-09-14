'use client';

import {
  DealerSelfUpdateInput,
  type DealerProfile,
  type DealerProfileChange,
  type MapKind,
} from '@dealers-drive/contracts';
import { useActionState, useState, useTransition, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import { Field, invalidProps } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banner, Tag } from '@/components/ui/primitives';
import { ServiceInput } from '@/components/ui/service-input';
import {
  saveDealerProfileAction,
  withdrawProfileChangeAction,
  type ProfileFormState,
} from '@/features/dealer/profile-actions';

const EMPTY: ProfileFormState = { status: 'idle', fieldErrors: {} };

export function DealerProfileForm({ dealer }: { dealer: DealerProfile }) {
  const [state, formAction] = useActionState(saveDealerProfileAction, EMPTY);
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
            ? 'Saved. Your line and services go to us for a quick check before they appear on your public page — everything else is already live.'
            : 'Your profile has been saved.'}
        </Banner>
      ) : null}
      {state.message ? <Banner tone="err">{state.message}</Banner> : null}

      <ReviewPanel change={dealer.profileChange} />

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">Dealership</h2>

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <LockedField id="legalName" label="Dealership name" value={dealer.legalName} />

          <Field id="establishedYear" label="Established" error={establishedYearError}>
            <Input
              id="establishedYear"
              name="establishedYear"
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              className="tnum"
              defaultValue={dealer.establishedYear ?? ''}
              onChange={() => setYearError(undefined)}
              onInvalid={(event) => {
                event.preventDefault();
                const result = DealerSelfUpdateInput.safeParse({
                  establishedYear: event.currentTarget.valueAsNumber,
                });
                setYearError(result.error?.issues[0]?.message ?? 'Enter a valid year.');
              }}
              {...invalidProps('establishedYear', establishedYearError)}
            />
          </Field>
        </div>

        <Field
          id="tagline"
          label="One line about your dealership"
          hint={
            waiting
              ? 'waiting for review — cancel above to change it'
              : 'shown under your name on your public page — checked before it appears'
          }
          error={errors.tagline}
        >
          <Input
            id="tagline"
            {...(waiting ? {} : { name: 'tagline' })}
            minLength={10}
            maxLength={200}
            defaultValue={taglineValue}
            placeholder="Quality pre-owned cars since 1998 — professionally inspected, with expert support."
            required={!waiting}
            aria-required={waiting ? undefined : 'true'}
            disabled={Boolean(waiting)}
            {...invalidProps('tagline', errors.tagline)}
          />
        </Field>

        <Field
          id="specialities"
          label="Services you offer"
          hint={
            waiting
              ? 'waiting for review — cancel above to change them'
              : 'one at a time, up to 12 — checked before they appear'
          }
          error={errors.specialities}
        >
          <ServiceInput
            id="specialities"
            {...(waiting ? {} : { name: 'specialities' })}
            value={servicesValue}
            placeholder="In-house workshop"
            required={!waiting}
            disabled={Boolean(waiting)}
            {...invalidProps('specialities', errors.specialities)}
          />
        </Field>
      </section>

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">Contact</h2>
        <LockedNote>
          These are how buyers and we reach a business that has been verified. Contact support to
          change any of them.
        </LockedNote>

        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <LockedField id="contactFullName" label="Contact name" value={dealer.contact.fullName} />
          <LockedField id="contactEmail" label="Email" value={dealer.contact.email} />
          <LockedField id="contactPhone" label="Mobile" value={dealer.contact.phoneDisplay} mono />
          <LockedField id="contactLandline" label="Landline" value={dealer.contact.landline} mono />
        </div>
      </section>

      <section className="card gap-[14px] p-[18px]">
        <h2 className="text-[19px]">Address</h2>
        <LockedNote>
          Your address and map pin are what your verification was about — the yard photograph, the
          address proof and the check we ran on them. They cannot be edited here. A dealership that
          has actually moved closes this account and opens a new one, so the new premises are
          verified the way these were. Contact support to start that.
        </LockedNote>

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

function ReviewPanel({ change }: { change: DealerProfileChange | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!change) return null;

  if (change.status === 'REJECTED') {
    return (
      <Banner tone="err" title="Your last change was not published">
        <p className="border-l-2 border-current pl-[10px] font-medium">{change.decisionReason}</p>
        <p className="mt-[8px]">
          Your public page is unchanged. Edit the boxes below and save again — there is nothing else
          you need to do.
        </p>
      </Banner>
    );
  }

  return (
    <Banner tone="warn" title="Waiting for a quick check">
      <p>
        You changed how your dealership describes itself on {change.submittedAtLabel}. We read these
        before they go on your public page — buyers see the current version until then.
      </p>
      <dl className="mt-[10px] flex flex-col gap-[8px] text-[12px]">
        {change.tagline ? (
          <div>
            <dt className="ink-muted">Your new line</dt>
            <dd className="mt-[2px] font-medium">“{change.tagline}”</dd>
          </div>
        ) : null}
        {change.specialities.length > 0 ? (
          <div>
            <dt className="ink-muted">Your new services</dt>
            <dd className="mt-[4px] flex flex-wrap gap-[6px]">
              {change.specialities.map((service) => (
                <Tag key={service} variant="neutral" className="text-[11px]">
                  {service}
                </Tag>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>
      {error ? <p className="mt-[8px] text-[12px] font-medium">{error}</p> : null}

      <div className="mt-[10px] flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              setError(await withdrawProfileChangeAction());
            });
          }}
        >
          Cancel this change
        </Button>
        <span className="text-[12px]">
          Your previous wording comes back and the boxes below unlock.
        </span>
      </div>
    </Banner>
  );
}

function LockedField({
  id,
  label,
  value,
  mono,
  children,
}: {
  id: string;
  label: string;
  value: string | null;
  mono?: boolean;
  children?: ReactNode;
}) {
  return (
    <Field id={id} label={label}>
      <Input
        id={id}
        className={mono ? 'font-mono' : undefined}
        defaultValue={value ?? '—'}
        disabled
      />
      {children}
    </Field>
  );
}

function LockedNote({ children }: { children: ReactNode }) {
  return <p className="text-[12px] ink-subtle">{children}</p>;
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

function MapKindNote({ mapsUrl, kind }: { mapsUrl: string | null; kind: MapKind }) {
  if (!mapsUrl) return null;

  if (kind === 'PLACE') {
    return (
      <p className="mt-[6px] text-[11px] text-(--color-ok)">
        This link names your dealership, so your public page shows your Google listing on the map —
        your name, your address and your rating.
      </p>
    );
  }

  if (kind === 'POINT') {
    return (
      <p className="mt-[6px] text-[11px] text-(--color-warn)">
        This link marks the right spot but does not name your dealership, so buyers see a plain pin
        rather than your Google listing. Contact support if you would like it changed to your
        business card.
      </p>
    );
  }

  return (
    <p className="mt-[6px] text-[11px] text-(--color-warn)">
      We could not read a location out of this link, so your public page shows no map. “Get
      directions” still works. Contact support and we will re-point it.
    </p>
  );
}
