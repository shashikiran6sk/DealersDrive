'use client';

import { Button } from '@/components/ui/button';
import { StatusTag } from '@/components/ui/primitives';

import { PHONE_TEXT } from './phone-verification.constants';

export interface PhoneVerifiedProps {
  display: string;
  fullName: string;
  accountsLinked?: boolean;
  onContinue: () => void;
  title?: string;
  continueLabel?: string;
}

export function PhoneVerified({
  display,
  fullName,
  accountsLinked = false,
  onContinue,
  title = PHONE_TEXT.verifiedTitle,
  continueLabel = PHONE_TEXT.continueToBusiness,
}: PhoneVerifiedProps) {
  return (
    <section
      aria-live="polite"
      className="border border-[color-mix(in_srgb,#0f7a5a_30%,transparent)] bg-(--color-ok-bg) px-[18px] py-[16px]"
    >
      <div className="flex flex-wrap items-center gap-[12px]">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-(--color-ok)">{title}</h2>
          <p className="mt-[2px] text-[13px] ink-body">
            <span className="tnum font-medium">{display}</span> has been linked to{' '}
            <span className="font-medium">{fullName.trim() || PHONE_TEXT.yourAccount}</span>.
          </p>
          {accountsLinked ? (
            <p className="mt-[6px] text-[13px] ink-body">{PHONE_TEXT.accountsLinked}</p>
          ) : null}
        </div>
        <StatusTag tone="ok">{PHONE_TEXT.verifiedTag}</StatusTag>
      </div>

      <div className="mt-[16px] flex flex-wrap items-center justify-between gap-[10px] border-t border-[color-mix(in_srgb,#0f7a5a_30%,transparent)] pt-[14px]">
        <span className="text-[12px] ink-secondary">{PHONE_TEXT.nextStep}</span>
        <Button variant="primary" size="md" onClick={onContinue}>
          {continueLabel}
        </Button>
      </div>
    </section>
  );
}
