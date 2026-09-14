'use client';

import type {
  AuthSession,
  CompletenessResponse,
  DealerDocumentDto,
  DealerProfile,
  PhoneOtpWidget,
  YardPhotoDto,
} from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';

import { Banner, Stepper } from '@/components/ui/primitives';
import {
  onboardingAction,
  updateOnboardingAction,
  type ActionState,
} from '@/features/auth/actions';
import { PhoneVerification } from '@/features/auth/phone-verification';

import { AccountStep } from './account-step';
import { BusinessStep } from './business-step';
import { DocumentsStep } from './documents-step';
import {
  ACCOUNT_FIELDS,
  ONBOARDING_PATH,
  ONBOARDING_STEPS,
  ONBOARDING_TEXT,
} from './onboarding-wizard.constants';
import type { LocalStep, OnboardingStep } from './onboarding-wizard.types';
import { ReviewStep } from './review-step';
import { localDigits, outstandingLabels, validateAccount } from './utils';

export interface OnboardingWizardProps {
  step: OnboardingStep;
  session: AuthSession;
  documents: DealerDocumentDto[];
  dealer: DealerProfile | null;
  completeness: CompletenessResponse | null;
  yardPhoto: YardPhotoDto | null;
  /** `GET /v1/auth/phone/widget` (**R39**), or null when it could not be read. */
  phoneWidget: PhoneOtpWidget | null;
}

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
 * **A refusal is shown on the step that can act on it.** Both uniqueness
 * checks — the phone number and the registered name — are answered by the
 * write, which happens when step 2 submits. But the phone number is typed on
 * *step 1*, so a 409 against it used to land the dealer on the Business step
 * with a banner about a field they could not see, and no way to tell which box
 * was wrong. `ACCOUNT_FIELDS` below is what the wizard walks back for: when the
 * API names one of them, the form returns to step 1 and the message renders
 * against the input it belongs to.
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
export function OnboardingWizard({
  step,
  session,
  documents,
  dealer,
  completeness,
  yardPhoto,
  phoneWidget,
}: OnboardingWizardProps) {
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
  const [local, setLocal] = useState<LocalStep>(step === 1 ? 1 : 0);

  /**
   * A navigation between steps 1 and 2 has to move the local pair with it.
   *
   * `local` is initialised once, and Next keeps this component mounted across a
   * `?step=` change — same route, same position in the tree — so `Back` from
   * the Documents step pushed `?step=1` and arrived showing whatever half of
   * the pair happened to be open, which was Account, because that is what it
   * was initialised to when the page was entered at step 3. Reconciled during
   * render rather than in an effect, so the step and the pane change in one
   * paint instead of the wrong pane being committed first.
   */
  const [navigated, setNavigated] = useState(step);
  if (navigated !== step) {
    setNavigated(step);
    setLocal(step === 1 ? 1 : 0);
  }

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

  /**
   * A refusal that names a step 1 field walks the wizard back to step 1.
   *
   * The commonest one by far is `PHONE_ALREADY_REGISTERED`: the number belongs
   * to another dealership, the API says so against `body.phone`, and `phone` is
   * three fields up on a step that is currently hidden. Without this the dealer
   * reads "that mobile number is already registered" while looking at the city
   * and pincode boxes.
   *
   * Adjusted *during* render, on the render that first sees a new `state`,
   * rather than in an effect. `useActionState` delivers the answer as a render,
   * and React re-runs this component immediately on a set made this way — so
   * the message and the step change land in one paint. An effect would commit
   * the error against a hidden fieldset first and move on the next frame, and
   * that gap is real: it is exactly what the test on a slow machine sees.
   *
   * `answered` is what makes it fire once per submission instead of on every
   * render: `state` is a fresh object each time the action resolves.
   */
  const [answered, setAnswered] = useState(state);
  if (answered !== state) {
    setAnswered(state);
    if (Object.keys(state.errors ?? {}).some((field) => ACCOUNT_FIELDS.has(field))) setLocal(0);
  }

  const current = step >= 2 ? step : local;

  /**
   * Step 1's two answers, held here rather than in the DOM (**R39**).
   *
   * Everything else on this form is uncontrolled — `defaultValue`, read back
   * out of `form.elements` — and that was right while the fields were only
   * ever read on submit. The mobile number stopped being one of those: the
   * verification panel below renders it, sends a message to it and compares
   * what came back against it, all between keystrokes. A value three
   * components need to agree about, live, is state.
   *
   * `fullName` comes with it because the success panel names the person the
   * number was linked to, and a name read once on mount would be the one they
   * had typed before they corrected it.
   */
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

  /**
   * The number this account has proved, as ten digits — or null.
   *
   * Seeded from the session, which is the only authority on it, and moved only
   * by `POST /v1/auth/phone/verify` answering yes. Comparing it to what is in
   * the box is what makes editing the number drop the panel out of its
   * verified state: there is one fact here and one place it is read from,
   * rather than a "verified" flag that could outlive the value it was about.
   */
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(() => {
    const digits = localDigits(session.user.phone);
    // The length check is not belt-and-braces: a session with no number at all
    // reduces to `''`, and `'' === ''` would make an empty box read as verified.
    return session.user.phoneVerified && digits.length === 10 ? digits : null;
  });
  const phoneVerified = verifiedPhone !== null && verifiedPhone === localDigits(phone);

  function continueFromAccount(form: HTMLFormElement | null): boolean {
    const found = validateAccount(form);
    setAccountErrors(found);
    return Object.keys(found).length === 0;
  }

  /**
   * The note an admin sent this application back with.
   *
   * `statusReason` is only set on a DRAFT dealership by one thing — a moderator
   * pressing *Request changes*, or rejecting one document — so its presence is
   * what distinguishes an application that was looked at and handed back from
   * one that was never finished. It is shown on every step rather than only the
   * first, because the thing that needs fixing may be three steps along and a
   * banner that scrolls away with the step is a banner the dealer reads once.
   */
  const sentBack = dealer?.status === 'DRAFT' ? dealer.statusReason : null;

  return (
    <div className="flex flex-col gap-[22px]">
      <Stepper steps={ONBOARDING_STEPS} current={current} />

      {sentBack ? (
        <Banner tone="warn" title={ONBOARDING_TEXT.sentBackTitle}>
          {/*
            The moderator's own words, set apart from the sentence under them:
            this is the one line a person wrote about *this* dealership and the
            only thing on the screen that says what to fix, so it has to survive
            being skimmed. A rule and a heavier weight rather than a second
            colour — the accent is `currentColor`, so it stays legible in whatever
            the tone resolves to. `whitespace-pre-line` because a moderator
            listing two problems types them on two lines.
          */}
          <p className="my-[2px] whitespace-pre-line border-l-[3px] border-current/40 py-[2px] pl-[10px] text-[14px] font-semibold">
            {sentBack}
          </p>
          <p className="mt-[6px]">{ONBOARDING_TEXT.sentBackNote}</p>
        </Banner>
      ) : null}

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
            errors={errors}
            hidden={local === 1}
            fullName={fullName}
            onFullNameChange={setFullName}
            phone={phone}
            onPhoneChange={setPhone}
            phoneVerified={phoneVerified}
          />
          <BusinessStep dealer={dealer} errors={errors} values={values} hidden={local === 0} />

          {/*
            Step 1's forward action is inside the panel, not in the footer: it is
            three different buttons across three states, and a footer that tried
            to draw the right one would be a second copy of the panel's state
            machine. It stays mounted while step 2 is showing, `hidden`, for the
            reason the fieldsets do — unmounting it on a local move would throw
            away a countdown and a half-typed code.
          */}
          <div hidden={local === 1}>
            <PhoneVerification
              widget={phoneWidget}
              phone={phone}
              fullName={fullName}
              verified={phoneVerified}
              onBeforeSend={continueFromAccount}
              onRefused={(message) => {
                // Against the box, not only in the panel — it is a refusal
                // about the number the dealer typed.
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

          {/*
            Step 2's footer, and only step 2's — which is why the whole row is
            hidden on step 1 rather than each button being conditional.

            Step 1 is the first step, and the first step has nothing behind it:
            the baseline sent `Back` here to `/dealer/login`, which is not a
            step of this wizard — it signs the dealer out of the flow they are
            halfway through. Its forward action is in the verification panel
            above, because a number that has not been proved is not a step
            anyone may leave.
          */}
          <div className="flex gap-[8px]" hidden={local === 0}>
            <button
              type="button"
              className="btn btn-secondary h-[42px] px-[18px]"
              onClick={() => setLocal(0)}
            >
              {ONBOARDING_TEXT.back}
            </button>

            {/*
              One button now, and it is always the submit. It used to be two — a
              local move on Account, a submit on Business — reconciled as one DOM
              node and needing distinct `key`s to stop a single press doing both.
              R39 removed the pair rather than the symptom.
            */}
            <button type="submit" className="btn btn-primary h-[42px] flex-1" disabled={pending}>
              {pending
                ? edit
                  ? ONBOARDING_TEXT.saving
                  : ONBOARDING_TEXT.creating
                : ONBOARDING_TEXT.continue}
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
          onBack={() => router.push(ONBOARDING_PATH.account)}
          onDone={() => router.push(ONBOARDING_PATH.review)}
        />
      ) : null}

      {current === 3 ? <ReviewStep session={session} completeness={completeness} /> : null}
    </div>
  );
}
