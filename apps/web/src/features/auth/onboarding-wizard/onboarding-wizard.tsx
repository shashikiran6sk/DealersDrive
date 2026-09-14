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
  phoneWidget: PhoneOtpWidget | null;
}

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
  const [local, setLocal] = useState<LocalStep>(step === 1 ? 1 : 0);

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
        <Banner tone="warn" title={ONBOARDING_TEXT.sentBackTitle}>
          <p className="my-[2px] whitespace-pre-line border-l-[3px] border-current/40 py-[2px] pl-[10px] text-[14px] font-semibold">
            {sentBack}
          </p>
          <p className="mt-[6px]">{ONBOARDING_TEXT.sentBackNote}</p>
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
              {ONBOARDING_TEXT.back}
            </button>

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
