'use client';

import type { AuthSession } from '@dealers-drive/contracts';

import { GoogleSignInButton } from '@/components/auth/google-button';
import { Field, invalidProps } from '@/components/forms/field';
import { StatusTag } from '@/components/ui/primitives';

import { ONBOARDING_TEXT } from './onboarding-wizard.constants';

export interface AccountStepProps {
  session: AuthSession;
  errors: Record<string, string>;
  hidden: boolean;
  fullName: string;
  onFullNameChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  phoneVerified: boolean;
  googleLinkUrl: string | null;
}

export function AccountStep({
  session,
  errors,
  hidden,
  fullName,
  onFullNameChange,
  phone,
  onPhoneChange,
  phoneVerified,
  googleLinkUrl,
}: AccountStepProps) {
  return (
    <fieldset hidden={hidden} className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">{ONBOARDING_TEXT.accountLegend}</legend>

      <h1 className="font-heading text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">
        {ONBOARDING_TEXT.accountHeading}
      </h1>
      <p className="mb-[20px] mt-[8px] text-[15px] ink-secondary">{ONBOARDING_TEXT.accountIntro}</p>

      {session.identity ? (
        <div className="mb-[16px] flex items-center gap-[10px] border border-(--color-divider) bg-(--color-accent-100) px-[13px] py-[10px]">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.1em] text-(--color-accent-800)">
              {ONBOARDING_TEXT.googleAccount}
            </div>
            <div className="truncate text-[14px] font-medium">{session.identity.email}</div>
          </div>
          <StatusTag tone="ok" className="ml-auto">
            {ONBOARDING_TEXT.verifiedWithGoogle}
          </StatusTag>
        </div>
      ) : (
        <div
          className="mb-[16px] flex flex-col gap-[10px] border border-(--color-divider) px-[13px] py-[12px]"
          aria-describedby={errors.google ? 'google-error' : undefined}
        >
          <div className="flex items-center gap-[10px]">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.1em] ink-secondary">
                {ONBOARDING_TEXT.googleAccount}
              </div>
              <div className="text-[14px] font-medium">{ONBOARDING_TEXT.googleNotLinked}</div>
            </div>
            <StatusTag tone="warn" className="ml-auto">
              {ONBOARDING_TEXT.googleRequired}
            </StatusTag>
          </div>
          <p className="m-0 text-[13px] ink-secondary">{ONBOARDING_TEXT.googleNotLinkedNote}</p>
          <GoogleSignInButton
            href={googleLinkUrl ?? '#'}
            label={ONBOARDING_TEXT.linkGoogle}
            disabled={!googleLinkUrl}
          />
          {errors.google ? (
            <p id="google-error" role="alert" className="m-0 text-[11px] text-(--color-err)">
              {errors.google}
            </p>
          ) : null}
        </div>
      )}

      <div className="grid gap-[14px] sm:grid-cols-2">
        <Field id="fullName" label={ONBOARDING_TEXT.fullNameLabel} error={errors.fullName}>
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

        <Field
          id="phone"
          label={ONBOARDING_TEXT.phoneLabel}
          hint={ONBOARDING_TEXT.phoneHint}
          error={errors.phone}
        >
          <input
            id="phone"
            name="phone"
            className="input tnum"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder={ONBOARDING_TEXT.phonePlaceholder}
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
