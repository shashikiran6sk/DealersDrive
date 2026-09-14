'use client';

import {
  isIndianMobile,
  type AuthSession,
  type CompletenessResponse,
  type DealerDocumentDto,
  type DealerProfile,
  type PhoneOtpWidget,
  type YardPhotoDto,
} from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';

import { Field, invalidProps } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { ServiceInput } from '@/components/ui/service-input';
import { Banner, Blueprint, StatusTag, Stepper } from '@/components/ui/primitives';
import {
  onboardingAction,
  saveBusinessIdsAction,
  submitForVerificationAction,
  updateOnboardingAction,
  type ActionState,
} from '@/features/auth/actions';
import { DocumentUploader } from '@/features/auth/document-uploader';
import { PhoneVerification } from '@/features/auth/phone-verification';
import { YardPhotoUploader } from '@/features/auth/yard-photo-uploader';
import { servicesOf } from '@/lib/services';

export const ONBOARDING_STEPS = ['Account', 'Business', 'Documents', 'Review'] as const;

export type OnboardingStep = 0 | 1 | 2 | 3;

export function OnboardingWizard({
  step,
  session,
  documents,
  dealer,
  completeness,
  yardPhoto,
  phoneWidget,
}: {
  step: OnboardingStep;
  session: AuthSession;
  documents: DealerDocumentDto[];
  dealer: DealerProfile | null;
  completeness: CompletenessResponse | null;
  yardPhoto: YardPhotoDto | null;
  phoneWidget: PhoneOtpWidget | null;
}) {
  const router = useRouter();
  const [local, setLocal] = useState<0 | 1>(step === 1 ? 1 : 0);

  const [navigated, setNavigated] = useState(step);
  if (navigated !== step) {
    setNavigated(step);
    setLocal(step === 1 ? 1 : 0);
  }

  const edit = dealer !== null;
  const [state, submit, pending] = useActionState<ActionState, FormData>(
    edit ? updateOnboardingAction : onboardingAction,
    {},
  );

  const [accountErrors, setAccountErrors] = useState<Record<string, string>>({});

  const values = state.values ?? {};
  const errors = { ...(state.errors ?? {}), ...accountErrors };

  const [answered, setAnswered] = useState(state);
  if (answered !== state) {
    setAnswered(state);
    if (Object.keys(state.errors ?? {}).some((field) => ACCOUNT_FIELDS.has(field))) setLocal(0);
  }

  const current = step >= 2 ? step : local;

  const [fullName, setFullName] = useState(
    values.fullName ??
      dealer?.contact.fullName ??
      session.user.fullName ??
      session.identity?.name ??
      '',
  );
  const [phone, setPhone] = useState(
    localDigits(values.phone ?? dealer?.contact.phone ?? session.user.phone),
  );

  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(() => {
    const digits = localDigits(session.user.phone);
    return session.user.phoneVerified && digits.length === 10 ? digits : null;
  });
  const phoneVerified = verifiedPhone !== null && verifiedPhone === localDigits(phone);

  function continueFromAccount(form: HTMLFormElement | null): boolean {
    const found = validateAccount(form);
    setAccountErrors(found);
    return Object.keys(found).length === 0;
  }

  const sentBack = dealer?.status === 'DRAFT' ? dealer.statusReason : null;

  return (
    <div className="flex flex-col gap-[22px]">
      <Stepper steps={ONBOARDING_STEPS} current={current} />

      {sentBack ? (
        <Banner tone="warn" title="We need one thing changed before we can verify you">
          <p className="my-[2px] whitespace-pre-line border-l-[3px] border-current/40 py-[2px] pl-[10px] text-[14px] font-semibold">
            {sentBack}
          </p>
          <p className="mt-[6px]">
            Everything you entered is still here. Fix what is named above and submit again.
          </p>
        </Banner>
      ) : null}

      {state.message ? (
        <Banner tone="err" title={state.message}>
          {Object.keys(state.errors ?? {}).length === 0 &&
          outstandingLabels(completeness).length > 0 ? (
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
            errors={errors}
            hidden={local === 1}
            fullName={fullName}
            onFullNameChange={setFullName}
            phone={phone}
            onPhoneChange={setPhone}
            phoneVerified={phoneVerified}
          />
          <BusinessStep dealer={dealer} errors={errors} values={values} hidden={local === 0} />

          <div hidden={local === 1}>
            <PhoneVerification
              widget={phoneWidget}
              phone={phone}
              fullName={fullName}
              verified={phoneVerified}
              onBeforeSend={continueFromAccount}
              onRefused={(message) => {
                setAccountErrors((found) => ({ ...found, phone: message }));
              }}
              onVerified={(verified) => {
                setVerifiedPhone(localDigits(verified));
              }}
              onContinue={() => {
                setLocal(1);
              }}
            />
          </div>

          <div className="flex gap-[8px]" hidden={local === 0}>
            <button
              type="button"
              className="btn btn-secondary h-[42px] px-[18px]"
              onClick={() => setLocal(0)}
            >
              Back
            </button>

            <button type="submit" className="btn btn-primary h-[42px] flex-1" disabled={pending}>
              {pending ? (edit ? 'Saving…' : 'Creating your dealership…') : 'Continue'}
            </button>
          </div>
        </form>
      ) : null}

      {current === 2 ? (
        <DocumentsStep
          documents={documents}
          dealer={dealer}
          yardPhoto={yardPhoto}
          completeness={completeness}
          onBack={() => router.push('/dealer/onboarding?step=1')}
          onDone={() => router.push('/dealer/onboarding?step=3')}
        />
      ) : null}

      {current === 3 ? <ReviewStep session={session} completeness={completeness} /> : null}
    </div>
  );
}

const ACCOUNT_FIELDS = new Set(['fullName', 'phone']);

function validateAccount(form: HTMLFormElement | null): Record<string, string> {
  if (!form) return {};

  const value = (name: string): string => {
    const field = form.elements.namedItem(name);
    return field instanceof HTMLInputElement || field instanceof HTMLSelectElement
      ? field.value.trim()
      : '';
  };

  const errors: Record<string, string> = {};
  if (value('fullName').length < 2) errors.fullName = 'Tell us your name.';
  if (!isIndianMobile(value('phone'))) {
    errors.phone = 'Enter a 10-digit Indian mobile number.';
  }
  return errors;
}

function localDigits(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function AccountStep({
  session,
  errors,
  hidden,
  fullName,
  onFullNameChange,
  phone,
  onPhoneChange,
  phoneVerified,
}: {
  session: AuthSession;
  errors: Record<string, string>;
  hidden: boolean;
  fullName: string;
  onFullNameChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  phoneVerified: boolean;
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
            value={fullName}
            onChange={(event) => {
              onFullNameChange(event.target.value);
            }}
            required
            aria-required="true"
            {...invalidProps('fullName', errors.fullName)}
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
            value={phone}
            onChange={(event) => {
              onPhoneChange(event.target.value);
            }}
            required
            aria-required="true"
            readOnly={phoneVerified}
            aria-readonly={phoneVerified || undefined}
            {...invalidProps('phone', errors.phone)}
          />
        </Field>
      </div>
    </fieldset>
  );
}

function BusinessStep({
  dealer,
  errors,
  hidden,
  values,
}: {
  dealer: DealerProfile | null;
  errors: Record<string, string>;
  hidden: boolean;
  values: Record<string, string>;
}) {
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
              minLength={10}
              maxLength={200}
              defaultValue={values.tagline ?? dealer?.tagline ?? ''}
              placeholder="Quality pre-owned cars since 1998 — professionally inspected, with expert support."
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

function DocumentsStep({
  documents,
  dealer,
  yardPhoto,
  completeness,
  onBack,
  onDone,
}: {
  documents: DealerDocumentDto[];
  dealer: DealerProfile | null;
  yardPhoto: YardPhotoDto | null;
  completeness: CompletenessResponse | null;
  onBack: () => void;
  onDone: () => void;
}) {
  const [state, submit, pending] = useActionState<ActionState, FormData>(saveBusinessIdsAction, {});
  const values = state.values ?? {};

  const outstanding = stepOutstanding(completeness, 'documents').concat(
    stepOutstanding(completeness, 'business'),
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        <h1 className="font-heading text-[34px] font-semibold leading-[1.1] tracking-[-0.02em]">
          Business verification
        </h1>
        <p className="mt-[8px] text-[15px] ink-secondary">
          Your registrations, three documents and a photo of your yard, reviewed by our team.
          Listings can be prepared while this is pending — they go live once you are verified.
        </p>
      </div>

      {state.message ? <Banner tone="err">{state.message}</Banner> : null}
      {state.saved ? <Banner tone="ok">Saved.</Banner> : null}

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
              required
              aria-required="true"
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
              required
              aria-required="true"
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

      {yardPhoto ? <YardPhotoUploader photo={yardPhoto} /> : null}

      {outstanding.length > 0 ? (
        <Banner tone="warn" title="Still needed before you can submit">
          <ul className="mt-[4px] list-disc pl-[18px]">
            {outstanding.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </Banner>
      ) : null}

      <div className="flex gap-[8px]">
        <button type="button" className="btn btn-secondary h-[42px] px-[18px]" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn btn-primary h-[42px] flex-1"
          disabled={outstanding.length > 0}
          onClick={onDone}
        >
          Continue
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

const MISSING_LABELS: Record<string, string> = {
  gstin: 'GSTIN',
  pan: 'PAN',
  GST_CERTIFICATE: 'GST certificate',
  PAN_CARD: 'PAN card',
  ADDRESS_PROOF: 'Address proof',
  YARD_PHOTO: 'Photo of your yard',
  legalName: 'Dealership name',
  addressLine: 'Address',
  pincode: 'Pincode',
  city: 'City',
  district: 'District',
  state: 'State',
  mapsUrl: 'Google Maps location',
  tagline: 'One line about your dealership',
  specialities: 'Services you offer',
  fullName: 'Your name',
  phone: 'Phone number',
  email: 'Email address',
};

function outstandingLabels(completeness: CompletenessResponse | null): string[] {
  return (completeness?.steps ?? [])
    .flatMap((step) => step.missing)
    .map((key) => MISSING_LABELS[key] ?? key);
}

function stepOutstanding(completeness: CompletenessResponse | null, key: string): string[] {
  const step = completeness?.steps.find((candidate) => candidate.key === key);
  return (step?.missing ?? []).map((field) => MISSING_LABELS[field] ?? field);
}
