'use client';

import type {
  AuthSession,
  CitiesResponse,
  CompletenessResponse,
  DealerDocumentDto,
  DealerProfile,
} from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';

import { Field, invalidProps } from '@/components/forms/field';
import { Banner, Blueprint, StatusTag, Stepper } from '@/components/ui/primitives';
import {
  onboardingAction,
  saveBusinessIdsAction,
  submitForVerificationAction,
  type ActionState,
} from '@/features/auth/actions';
import { DocumentUploader } from '@/features/auth/document-uploader';

/**
 * DESIGN-SPEC §3.10 — Account → Business → Documents → Review.
 *
 * The split is not cosmetic. Steps 1 and 2 are one form: nothing is written
 * until "Continue" on the Business step, so a dealer who abandons halfway
 * leaves no half-made tenant behind. Steps 3 and 4 act on a dealership that
 * exists, and are reached by a real navigation so the server can re-read it.
 *
 * Which step you may be on is decided on the server from the session. This
 * component moves between them; it does not decide what you are allowed to see.
 */
export const ONBOARDING_STEPS = ['Account', 'Business', 'Documents', 'Review'] as const;

export type OnboardingStep = 0 | 1 | 2 | 3;

export function OnboardingWizard({
  step,
  session,
  cities,
  documents,
  dealer,
  completeness,
}: {
  step: OnboardingStep;
  session: AuthSession;
  cities: CitiesResponse['data'];
  documents: DealerDocumentDto[];
  dealer: DealerProfile | null;
  completeness: CompletenessResponse | null;
}) {
  const router = useRouter();
  /**
   * Steps 1 and 2 move in the browser; steps 3 and 4 move by navigation.
   *
   * The asymmetry follows the write. Account and Business submit together, so
   * stepping between them must not touch the server — there is nothing to
   * re-read, and a round trip would cost the dealer everything they had typed.
   * Documents and Review each act on a dealership that already exists, so they
   * are reached by a URL the server resolves afresh.
   */
  const [local, setLocal] = useState<0 | 1>(step === 1 ? 1 : 0);
  const [state, submit, pending] = useActionState<ActionState, FormData>(onboardingAction, {});
  // What the dealer typed, echoed back by the action. A rejected pincode must
  // not cost them the other eight fields.
  const values = state.values ?? {};

  const current = step >= 2 ? step : local;

  return (
    <div className="flex flex-col gap-[22px]">
      <Stepper steps={ONBOARDING_STEPS} current={current} />

      {state.message ? (
        <Banner tone="err" title={state.message}>
          {/* The API refuses an incomplete dealership; this says which part. */}
          {outstandingLabels(completeness).length > 0 ? (
            <ul className="mt-[4px] list-disc pl-[18px]">
              {outstandingLabels(completeness).map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          ) : null}
        </Banner>
      ) : null}

      {current <= 1 ? (
        <form action={submit} className="flex flex-col gap-[18px]" noValidate>
          <AccountStep
            session={session}
            errors={state.errors ?? {}}
            values={values}
            hidden={local === 1}
          />
          <BusinessStep
            cities={cities}
            errors={state.errors ?? {}}
            values={values}
            hidden={local === 0}
          />

          <div className="flex gap-[8px]">
            <button
              type="button"
              className="btn btn-secondary h-[42px] px-[18px]"
              onClick={() => {
                if (local === 1) setLocal(0);
                else router.push('/dealer/login');
              }}
            >
              Back
            </button>

            {/**
             * Continue means two different things, and the difference is the
             * point of the two-step form. On Account it is a local move; on
             * Business it is the submit that creates the dealership. Nothing is
             * written until that second press, so a dealer who abandons halfway
             * leaves no half-made tenant behind.
             */}
            {local === 0 ? (
              <button
                type="button"
                className="btn btn-primary h-[42px] flex-1"
                onClick={() => setLocal(1)}
              >
                Continue
              </button>
            ) : (
              <button type="submit" className="btn btn-primary h-[42px] flex-1" disabled={pending}>
                {pending ? 'Creating your dealership…' : 'Continue'}
              </button>
            )}
          </div>
        </form>
      ) : null}

      {current === 2 ? (
        <DocumentsStep
          documents={documents}
          dealer={dealer}
          onDone={() => router.push('/dealer/onboarding?step=3')}
        />
      ) : null}

      {current === 3 ? <ReviewStep session={session} completeness={completeness} /> : null}
    </div>
  );
}

function AccountStep({
  session,
  errors,
  values,
  hidden,
}: {
  session: AuthSession;
  errors: Record<string, string>;
  values: Record<string, string>;
  hidden: boolean;
}) {
  return (
    <fieldset hidden={hidden} className="m-0 border-0 p-0">
      <legend className="sr-only">Your account</legend>

      <h1 className="font-heading text-[34px] font-semibold leading-[1.1] tracking-[-0.02em]">
        Create your account
      </h1>
      <p className="mb-[20px] mt-[8px] text-[15px] ink-secondary">
        This is the person who will manage the dealership on Dealers-Drive.
      </p>

      {/**
       * The verified identity, shown rather than asked for. Google has already
       * proved this address belongs to whoever is at the keyboard, and an
       * editable email field here would be a way to claim one it never verified
       * — the API would reject it, but the form should not offer it.
       */}
      <div className="mb-[16px] flex items-center gap-[10px] border border-(--color-divider) bg-(--color-accent-100) px-[13px] py-[10px]">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.1em] text-(--color-accent-800)">
            Google account
          </div>
          <div className="truncate text-[14px] font-medium">
            {session.identity?.email ?? session.user.email}
          </div>
        </div>
        <StatusTag tone="ok" className="ml-auto">
          Verified with Google
        </StatusTag>
      </div>

      <div className="grid gap-[14px] sm:grid-cols-2">
        <Field id="fullName" label="Full name" error={errors.fullName}>
          <input
            id="fullName"
            name="fullName"
            className="input"
            autoComplete="name"
            defaultValue={values.fullName ?? session.user.fullName ?? session.identity?.name ?? ''}
            required
            {...invalidProps('fullName', errors.fullName)}
          />
        </Field>

        <Field id="roleTitle" label="Role" hint="optional" error={errors.roleTitle}>
          <input
            id="roleTitle"
            name="roleTitle"
            className="input"
            autoComplete="organization-title"
            placeholder="Proprietor"
            defaultValue={values.roleTitle ?? session.user.roleTitle ?? ''}
            {...invalidProps('roleTitle', errors.roleTitle)}
          />
        </Field>

        <Field id="phone" label="Phone" hint="+91" error={errors.phone}>
          <input
            id="phone"
            name="phone"
            className="input tnum"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98400 12345"
            defaultValue={values.phone ?? session.user.phone}
            required
            {...invalidProps('phone', errors.phone)}
          />
        </Field>

        <Field id="email" label="Email">
          <input
            id="email"
            className="input"
            value={session.identity?.email ?? session.user.email ?? ''}
            disabled
            readOnly
          />
        </Field>
      </div>
    </fieldset>
  );
}

function BusinessStep({
  cities,
  errors,
  hidden,
  values,
}: {
  cities: CitiesResponse['data'];
  errors: Record<string, string>;
  hidden: boolean;
  values: Record<string, string>;
}) {
  // `/v1/cities` leads with an "All of Tamil Nadu" pseudo-city, which is a
  // *search filter*, not a place a dealership can be.
  const places = cities.filter((city) => city.slug !== 'all');
  const [citySlug, setCitySlug] = useState(values.citySlug ?? '');
  const state = places.find((city) => city.slug === citySlug)?.state ?? 'Tamil Nadu';

  return (
    <fieldset hidden={hidden} className="m-0 border-0 p-0">
      <legend className="sr-only">Your dealership</legend>

      <h1 className="font-heading text-[34px] font-semibold leading-[1.1] tracking-[-0.02em]">
        Dealership information
      </h1>
      <p className="mb-[20px] mt-[8px] text-[15px] ink-secondary">
        This is what buyers see on every one of your listings.
      </p>

      <div className="flex flex-col gap-[14px]">
        <Field id="brandName" label="Dealership name (public)" error={errors.brandName}>
          <input
            id="brandName"
            name="brandName"
            defaultValue={values.brandName ?? ''}
            className="input"
            autoComplete="organization"
            required
            {...invalidProps('brandName', errors.brandName)}
          />
        </Field>

        <Field id="legalName" label="Registered legal name" error={errors.legalName}>
          <input
            id="legalName"
            name="legalName"
            defaultValue={values.legalName ?? ''}
            className="input"
            required
            {...invalidProps('legalName', errors.legalName)}
          />
        </Field>

        <Field id="addressLine" label="Address" error={errors.addressLine}>
          <input
            id="addressLine"
            name="addressLine"
            defaultValue={values.addressLine ?? ''}
            className="input"
            autoComplete="street-address"
            required
            {...invalidProps('addressLine', errors.addressLine)}
          />
        </Field>

        <div className="grid gap-[14px] sm:grid-cols-2">
          <Field id="citySlug" label="City" error={errors.citySlug}>
            <select
              id="citySlug"
              name="citySlug"
              className="input"
              value={citySlug}
              onChange={(event) => setCitySlug(event.target.value)}
              required
              {...invalidProps('citySlug', errors.citySlug)}
            >
              <option value="" disabled>
                Select a city
              </option>
              {places.map((city) => (
                <option key={city.slug} value={city.slug}>
                  {city.name}
                </option>
              ))}
            </select>
          </Field>

          {/* Derived from the city, not typed: the catalogue owns the pair. */}
          <Field id="state" label="State">
            <input id="state" className="input" value={state} disabled readOnly />
          </Field>

          <Field id="pincode" label="Pincode" error={errors.pincode}>
            <input
              id="pincode"
              name="pincode"
              defaultValue={values.pincode ?? ''}
              className="input tnum"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              required
              {...invalidProps('pincode', errors.pincode)}
            />
          </Field>

          <Field id="landline" label="Landline" hint="optional" error={errors.landline}>
            <input
              id="landline"
              name="landline"
              defaultValue={values.landline ?? ''}
              className="input tnum"
              autoComplete="tel"
              placeholder="0416 224 8890"
              {...invalidProps('landline', errors.landline)}
            />
          </Field>
        </div>
      </div>
    </fieldset>
  );
}

function DocumentsStep({
  documents,
  dealer,
  onDone,
}: {
  documents: DealerDocumentDto[];
  dealer: DealerProfile | null;
  onDone: () => void;
}) {
  const outstanding = documents.filter((document) => document.status === 'REQUIRED').length;
  const [state, submit, pending] = useActionState<ActionState, FormData>(saveBusinessIdsAction, {});
  const values = state.values ?? {};

  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        <h1 className="font-heading text-[34px] font-semibold leading-[1.1] tracking-[-0.02em]">
          Business verification
        </h1>
        <p className="mt-[8px] text-[15px] ink-secondary">
          Your registrations and three documents, reviewed by our team. Listings can be prepared
          while this is pending — they go live once you are verified.
        </p>
      </div>

      {state.message ? <Banner tone="err">{state.message}</Banner> : null}
      {state.saved ? <Banner tone="ok">Saved.</Banner> : null}

      {/* GSTIN and PAN in mono, as the review screen renders them (§3.10). */}
      <form action={submit} className="flex flex-col gap-[14px]" noValidate>
        <div className="grid gap-[14px] sm:grid-cols-2">
          <Field id="gstin" label="GSTIN" error={state.errors?.gstin}>
            <input
              id="gstin"
              name="gstin"
              className="input font-mono uppercase"
              placeholder="33ABCDE1234F1Z5"
              maxLength={15}
              defaultValue={values.gstin ?? dealer?.gstin ?? ''}
              {...invalidProps('gstin', state.errors?.gstin)}
            />
          </Field>

          <Field id="pan" label="PAN" error={state.errors?.pan}>
            <input
              id="pan"
              name="pan"
              className="input font-mono uppercase"
              placeholder="ABCDE1234F"
              maxLength={10}
              defaultValue={values.pan ?? dealer?.pan ?? ''}
              {...invalidProps('pan', state.errors?.pan)}
            />
          </Field>
        </div>

        <button type="submit" className="btn btn-secondary self-start" disabled={pending}>
          {pending ? 'Saving…' : 'Save registrations'}
        </button>
      </form>

      <div className="flex flex-col gap-[10px]">
        {documents.map((document) => (
          <DocumentUploader key={document.type} document={document} />
        ))}
      </div>

      <div className="flex gap-[8px]">
        <button type="button" className="btn btn-secondary h-[42px] px-[18px]" onClick={onDone}>
          Skip for now
        </button>
        <button type="button" className="btn btn-primary h-[42px] flex-1" onClick={onDone}>
          {outstanding === 0 ? 'Continue' : `Continue (${outstanding} still to upload)`}
        </button>
      </div>
    </div>
  );
}

function ReviewStep({
  session,
  completeness,
}: {
  session: AuthSession;
  completeness: CompletenessResponse | null;
}) {
  const [state, submit, pending] = useActionState<ActionState, FormData>(
    async () => submitForVerificationAction(),
    {},
  );
  const submitted = session.dealer?.status === 'PENDING_APPROVAL';

  return (
    <div className="flex flex-col gap-[18px]">
      {state.message ? (
        <Banner tone="err" title={state.message}>
          {/* The API refuses an incomplete dealership; this says which part. */}
          {outstandingLabels(completeness).length > 0 ? (
            <ul className="mt-[4px] list-disc pl-[18px]">
              {outstandingLabels(completeness).map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          ) : null}
        </Banner>
      ) : null}

      <Blueprint className="bg-white p-[26px]">
        <StatusTag tone={submitted ? 'warn' : 'neutral'}>
          {submitted ? 'Under review' : 'Ready to submit'}
        </StatusTag>

        <h1 className="mt-[12px] font-heading text-[28px] font-semibold leading-[1.15] tracking-[-0.02em]">
          {submitted ? 'We are reviewing your dealership' : 'Submit for verification'}
        </h1>

        <p className="mt-[10px] text-[14px] leading-[1.6] ink-body">
          {submitted
            ? `Our team is checking ${session.dealer?.brandName ?? 'your dealership'} and the documents you uploaded. Verification usually takes one working day.`
            : 'Once you submit, our team checks your business details and documents. You can keep adding vehicles in the meantime.'}
        </p>
        <p className="mt-[8px] text-[14px] leading-[1.6] ink-body">
          You can add vehicles and prepare listings now. Publishing needs a verified dealership and
          one listing credit.
        </p>
      </Blueprint>

      <form action={submit} className="flex gap-[8px]">
        {submitted ? (
          <a href="/dealer" className="btn btn-primary h-[42px] flex-1">
            Go to dashboard
          </a>
        ) : (
          <>
            <a href="/dealer/onboarding?step=2" className="btn btn-secondary h-[42px] px-[18px]">
              Back
            </a>
            <button type="submit" className="btn btn-primary h-[42px] flex-1" disabled={pending}>
              {pending ? 'Submitting…' : 'Submit for verification'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

/**
 * What C3 says is still missing, in words a dealer can act on. The API answers
 * with field keys — `gstin`, `GST_CERTIFICATE` — which are precise and not
 * something to put in front of somebody at the end of a sign-up form.
 */
const MISSING_LABELS: Record<string, string> = {
  gstin: 'GSTIN',
  pan: 'PAN',
  GST_CERTIFICATE: 'GST certificate',
  PAN_CARD: 'PAN card',
  ADDRESS_PROOF: 'Address proof',
  brandName: 'Dealership name',
  legalName: 'Registered legal name',
  addressLine: 'Address',
  pincode: 'Pincode',
  cityId: 'City',
  fullName: 'Your name',
  phone: 'Phone number',
  email: 'Email address',
};

function outstandingLabels(completeness: CompletenessResponse | null): string[] {
  return (completeness?.steps ?? [])
    .flatMap((step) => step.missing)
    .map((key) => MISSING_LABELS[key] ?? key);
}
