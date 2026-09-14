'use client';

import type { AuthSession, CompletenessResponse } from '@dealers-drive/contracts';
import { useActionState } from 'react';

import { Blueprint, Banner, StatusTag } from '@/components/ui/primitives';
import { submitForVerificationAction, type ActionState } from '@/features/auth/actions';

import { ONBOARDING_PATH, ONBOARDING_TEXT } from './onboarding-wizard.constants';
import { outstandingLabels } from './utils';

export interface ReviewStepProps {
  session: AuthSession;
  completeness: CompletenessResponse | null;
}

export function ReviewStep({ session, completeness }: ReviewStepProps) {
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
          {submitted ? ONBOARDING_TEXT.underReview : ONBOARDING_TEXT.readyToSubmit}
        </StatusTag>

        <h1 className="mt-[12px] font-heading text-[28px] font-semibold leading-[1.15] tracking-[-0.02em]">
          {submitted ? ONBOARDING_TEXT.reviewingHeading : ONBOARDING_TEXT.submitHeading}
        </h1>

        <p className="mt-[10px] text-[14px] leading-[1.6] ink-body">
          {submitted
            ? ONBOARDING_TEXT.reviewingIntro(session.dealer?.brandName ?? 'your dealership')
            : ONBOARDING_TEXT.submitIntro}
        </p>
        <p className="mt-[8px] text-[14px] leading-[1.6] ink-body">{ONBOARDING_TEXT.prepareNote}</p>
      </Blueprint>

      <form action={submit} className="flex gap-[8px]">
        {submitted ? (
          <a href={ONBOARDING_PATH.dashboard} className="btn btn-primary h-[42px] flex-1">
            {ONBOARDING_TEXT.goToDashboard}
          </a>
        ) : (
          <>
            <a href={ONBOARDING_PATH.documents} className="btn btn-secondary h-[42px] px-[18px]">
              {ONBOARDING_TEXT.back}
            </a>
            <button type="submit" className="btn btn-primary h-[42px] flex-1" disabled={pending}>
              {pending ? ONBOARDING_TEXT.submitting : ONBOARDING_TEXT.submit}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
