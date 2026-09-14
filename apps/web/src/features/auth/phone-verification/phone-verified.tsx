'use client';

import { Button } from '@/components/ui/button';
import { StatusTag } from '@/components/ui/primitives';

import { PHONE_TEXT } from './phone-verification.constants';

export interface PhoneVerifiedProps {
  display: string;
  fullName: string;
  onContinue: () => void;
}

/** The number is settled, and the step's forward action is Continue. */
export function PhoneVerified({ display, fullName, onContinue }: PhoneVerifiedProps) {
  return (
    <section
      aria-live="polite"
      className="border border-[color-mix(in_srgb,#0f7a5a_30%,transparent)] bg-(--color-ok-bg) px-[18px] py-[16px]"
    >
      <div className="flex flex-wrap items-center gap-[12px]">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-(--color-ok)">
            {PHONE_TEXT.verifiedTitle}
          </h2>
          <p className="mt-[2px] text-[13px] ink-body">
            <span className="tnum font-medium">{display}</span> has been linked to{' '}
            <span className="font-medium">{fullName.trim() || PHONE_TEXT.yourAccount}</span>.
          </p>
        </div>
        <StatusTag tone="ok">{PHONE_TEXT.verifiedTag}</StatusTag>
      </div>

      <div className="mt-[16px] flex flex-wrap items-center justify-between gap-[10px] border-t border-[color-mix(in_srgb,#0f7a5a_30%,transparent)] pt-[14px]">
        <span className="text-[12px] ink-secondary">{PHONE_TEXT.nextStep}</span>
        <Button variant="primary" size="md" onClick={onContinue}>
          {PHONE_TEXT.continueToBusiness}
        </Button>
      </div>
    </section>
  );
}
