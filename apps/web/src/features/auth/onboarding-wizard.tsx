'use client';

import type {
  AuthSession,
  CompletenessResponse,
  DealerDocumentDto,
  DealerProfile,
  YardPhotoDto,
} from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';

import { Field, invalidProps } from '@/components/forms/field';
import { Banner, Blueprint, StatusTag, Stepper } from '@/components/ui/primitives';
import {
  onboardingAction,
  saveBusinessIdsAction,
  submitForVerificationAction,
  updateOnboardingAction,
  type ActionState,
} from '@/features/auth/actions';
import { DocumentUploader } from '@/features/auth/document-uploader';
import { YardPhotoUploader } from '@/features/auth/yard-photo-uploader';

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
 *
 * **Two rules run through every step here.**
 *
 * *Nothing advances on an empty required field.* Steps 2 and 4 were always
 * gated — one by Zod on the submit, one by `canSubmit` — while steps 1 and 3
 * were not, so a dealer could walk to the end of the wizard and only then be
 * told what they had skipped. Step 1 now validates in the browser before it
 * moves, and step 3 is gated on the server's own `completeness` answer, which
 * is the same condition `POST /v1/dealer/submit` enforces. Two derivations of
 * "is this ready" would eventually disagree, and the disagreement would be
 * about whether somebody is allowed to trade.
 *
 * *Every step but the first goes back.* That costs steps 1 and 2 a second
 * write path — once a dealership exists the create call refuses with
 * `DEALER_ALREADY_EXISTS` — so `edit` below picks `PATCH /v1/dealer` instead.
 * The fields, the layout and the validation are the same either way; only the
 * verb changes.
 *
 * **Where the duplicate check lands.** A dealership's name has to be unique
 * within its city, and both halves of that pair are typed on step 2 — so the
 * question can only be asked when this step submits. It is asked in the
 * database, by the write itself, rather than by a lookup as the dealer types:
 * a check answered before the submit is a check two applications can race past
 * between the answer and the write, and it would also hand anyone with a
 * browser a way to enumerate which dealerships exist where. A collision comes
 * back as a 409 that names `legalName`, so the step stays put with the message
 * against the field.
 */
export const ONBOARDING_STEPS = ['Account', 'Business', 'Documents', 'Review'] as const;

export type OnboardingStep = 0 | 1 | 2 | 3;

export function OnboardingWizard({
  step,
  session,
  documents,
  dealer,
  completeness,
  yardPhoto,
}: {
  step: OnboardingStep;
  session: AuthSession;
  documents: DealerDocumentDto[];
  dealer: DealerProfile | null;
  completeness: CompletenessResponse | null;
  yardPhoto: YardPhotoDto | null;
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

  // The same two steps, one verb apart: create the dealership, or amend the one
  // that is already there because the dealer pressed Back to get here.
  const edit = dealer !== null;
  const [state, submit, pending] = useActionState<ActionState, FormData>(
    edit ? updateOnboardingAction : onboardingAction,
    {},
  );

  /**
   * What step 1 refuses to move past, checked here rather than on submit.
   *
   * The server validates these too — it is the only thing that counts — but on
   * step 1 that verdict would not arrive until the dealer had filled in step 2
   * and pressed Continue, which is three fields and a city later than the
   * mistake. This is the message arriving where it can still be acted on.
   */
  const [accountErrors, setAccountErrors] = useState<Record<string, string>>({});

  // What the dealer typed, echoed back by the action. A rejected pincode must
  // not cost them the other eight fields.
  const values = state.values ?? {};
  const errors = { ...(state.errors ?? {}), ...accountErrors };

  const current = step >= 2 ? step : local;

  function continueFromAccount(form: HTMLFormElement | null): void {
    const found = validateAccount(form);
    setAccountErrors(found);
    if (Object.keys(found).length === 0) setLocal(1);
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <Stepper steps={ONBOARDING_STEPS} current={current} />

      {state.message ? (
        <Banner tone="err" title={state.message}>
          {/*
            The API refuses an incomplete dealership; this says which part.

            Only when nothing more specific came back, though. A refusal that
            names a field — a registered name already taken in this city, most
            of all — is already marked against the box it belongs to, and
            following it with a list of unrelated outstanding items reads as if
            those were the problem.
          */}
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
            dealer={dealer}
            errors={errors}
            values={values}
            hidden={local === 1}
          />
          <BusinessStep
            dealer={dealer}
            errors={errors}
            values={values}
            hidden={local === 0}
          />

          <div className="flex gap-[8px]">
            {/*
              Step 1 is the first step, and the first step has nothing behind
              it. The baseline sent `Back` here to `/dealer/login`, which is not
              a step of this wizard — it signs the dealer out of the flow they
              are halfway through.
            */}
            {local === 1 ? (
              <button
                type="button"
                className="btn btn-secondary h-[42px] px-[18px]"
                onClick={() => setLocal(0)}
              >
                Back
              </button>
            ) : null}

            {/**
             * Continue means two different things, and the difference is the
             * point of the two-step form. On Account it is a local move — taken
             * only once the required fields on it are filled — and on Business
             * it is the submit that creates or amends the dealership. Nothing is
             * written until that second press, so a dealer who abandons halfway
             * leaves no half-made tenant behind.
             */}
            {local === 0 ? (
              <button
                type="button"
                className="btn btn-primary h-[42px] flex-1"
                onClick={(event) => continueFromAccount(event.currentTarget.form)}
              >
                Continue
              </button>
            ) : (
              <button type="submit" className="btn btn-primary h-[42px] flex-1" disabled={pending}>
                {pending
                  ? edit
                    ? 'Saving…'
                    : 'Creating your dealership…'
                  : 'Continue'}
              </button>
            )}
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

/**
 * The required fields of step 1, read straight off the form.
 *
 * Off the DOM rather than out of React state, because these inputs are
 * uncontrolled — they carry `defaultValue` so that re-rendering the step never
 * discards what is half-typed in it. The form element is the state.
 */
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
  if (!/^(\+?91[- ]?)?[6-9]\d{9}$/.test(value('phone'))) {
    errors.phone = 'Enter a 10-digit Indian mobile number.';
  }
  return errors;
}

function AccountStep({
  session,
  dealer,
  errors,
  values,
  hidden,
}: {
  session: AuthSession;
  dealer: DealerProfile | null;
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
            defaultValue={
              values.fullName ??
              dealer?.contact.fullName ??
              session.user.fullName ??
              session.identity?.name ??
              ''
            }
            required
            aria-required="true"
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
            defaultValue={values.roleTitle ?? dealer?.contact.roleTitle ?? session.user.roleTitle ?? ''}
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
            defaultValue={values.phone ?? dealer?.contact.phone ?? session.user.phone}
            required
            aria-required="true"
            /*
              The login identity. Changing it needs an OTP round-trip on the new
              number, which onboarding does not have — so once the dealership
              exists this reads rather than asks. It is still submitted, because
              step 1's own validation reads the form.
            */
            readOnly={dealer !== null}
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
        {/*
          One name, not two.
          
          The baseline asked for a public brand name and a registered legal name
          side by side, and dealers filled both in with the same words — twice
          the typing for a distinction that never held. The registered name is
          the one KYC is checked against, so it is the one asked for, and it is
          what buyers see.
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

  /**
   * What this step is still missing, in the server's own words.
   *
   * Derived from `completeness` rather than counted here, because the same
   * answer is what `POST /v1/dealer/submit` refuses on. Counting `REQUIRED`
   * rows in the browser would be a second derivation of the same question, and
   * the two would eventually disagree about whether a dealership is ready.
   */
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

      {/*
        No "Skip for now".
        
        It was there because nothing downstream depended on this step being
        finished — and nothing did, right up until the review step refused to
        submit and listed everything that had been skipped. Saying so here, next
        to the fields it names, is the same information three screens earlier.
      */}
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
  YARD_PHOTO: 'Photo of your yard',
  legalName: 'Dealership name',
  addressLine: 'Address',
  pincode: 'Pincode',
  city: 'City',
  state: 'State',
  fullName: 'Your name',
  phone: 'Phone number',
  email: 'Email address',
};

function outstandingLabels(completeness: CompletenessResponse | null): string[] {
  return (completeness?.steps ?? [])
    .flatMap((step) => step.missing)
    .map((key) => MISSING_LABELS[key] ?? key);
}

/** The same, for one named step. */
function stepOutstanding(completeness: CompletenessResponse | null, key: string): string[] {
  const step = completeness?.steps.find((candidate) => candidate.key === key);
  return (step?.missing ?? []).map((field) => MISSING_LABELS[field] ?? field);
}
