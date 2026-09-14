'use client';

import type { AuthSession } from '@dealers-drive/contracts';

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
  /** Whether the number in the box is the one this account proved (**R39**). */
  phoneVerified: boolean;
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
}: AccountStepProps) {
  return (
    <fieldset hidden={hidden} className="m-0 border-0 p-0">
      <legend className="sr-only">{ONBOARDING_TEXT.accountLegend}</legend>

      <h1 className="font-heading text-[34px] font-semibold leading-[1.1] tracking-[-0.02em]">
        {ONBOARDING_TEXT.accountHeading}
      </h1>
      <p className="mb-[20px] mt-[8px] text-[15px] ink-secondary">
        {ONBOARDING_TEXT.accountIntro}
      </p>

      {/*
        The verified identity, shown rather than asked for. Google has already
        proved this address belongs to whoever is at the keyboard, and an
        editable email field would be a way to claim one it never verified.
      */}
      <div className="mb-[16px] flex items-center gap-[10px] border border-(--color-divider) bg-(--color-accent-100) px-[13px] py-[10px]">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.1em] text-(--color-accent-800)">
            {ONBOARDING_TEXT.googleAccount}
          </div>
          <div className="truncate text-[14px] font-medium">
            {session.identity?.email ?? session.user.email}
          </div>
        </div>
        <StatusTag tone="ok" className="ml-auto">
          {ONBOARDING_TEXT.verifiedWithGoogle}
        </StatusTag>
      </div>

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
            /**
             * Settled once it has been proved: a verified number is a fact about
             * a handset somebody answered, and typing over it would throw that
             * away — which is what used to happen on the way back from step 2.
             *
             * `readOnly` rather than `disabled`, and the difference is
             * load-bearing: a disabled input is **not submitted**, so the number
             * would vanish from the FormData that creates the dealership.
             */
            readOnly={phoneVerified}
            aria-readonly={phoneVerified || undefined}
            {...invalidProps('phone', errors.phone)}
          />
        </Field>
      </div>
    </fieldset>
  );
}
