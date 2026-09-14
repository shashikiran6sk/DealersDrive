'use client';

import type { PhoneOtpWidget } from '@dealers-drive/contracts';

import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import { pluralLabel } from '@/lib/plural';

import { Captcha } from './captcha';
import { OTP_DIGITS, PHONE_TEXT } from './phone-verification.constants';
import { countdown } from './utils';

export interface PhoneCodePanelProps {
  captchaId: string;
  widget: PhoneOtpWidget;
  display: string;
  code: string;
  onCodeChange: (next: string) => void;
  failed: boolean;
  failure: string | null;
  attemptsLeft: number;
  remaining: number;
  pending: boolean;
  onVerify: () => void;
  onResend: () => void;
  onReset: () => void;
}

export function PhoneCodePanel({
  captchaId,
  widget,
  display,
  code,
  onCodeChange,
  failed,
  failure,
  attemptsLeft,
  remaining,
  pending,
  onVerify,
  onResend,
  onReset,
}: PhoneCodePanelProps) {
  const exhausted = attemptsLeft <= 0;

  return (
    <section
      className={
        failed
          ? 'border border-[color-mix(in_srgb,#b3261e_30%,transparent)] bg-(--color-err-bg) px-[18px] py-[16px]'
          : 'border border-(--color-accent) bg-(--color-accent-100) px-[18px] py-[16px]'
      }
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (code.length === OTP_DIGITS && !exhausted) onVerify();
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-[8px]">
        <div className="min-w-0">
          <h2
            className={`text-[15px] font-semibold ${failed ? 'text-(--color-err)' : 'text-(--color-accent-800)'}`}
          >
            {failed ? PHONE_TEXT.failedTitle : PHONE_TEXT.codeTitle}
          </h2>
          <p className="mt-[2px] text-[13px] ink-body" aria-live="polite">
            {failed ? (
              <>
                {failure}{' '}
                {exhausted ? (
                  <strong>{PHONE_TEXT.askForNewCode}</strong>
                ) : (
                  <>
                    <strong className="tnum">{attemptsLeft}</strong>{' '}
                    {pluralLabel(attemptsLeft, 'attempt')} left before you need a new one.
                  </>
                )}
              </>
            ) : widget.driver === 'fake' ? (
              <>
                No SMS is sent in this environment — enter{' '}
                <strong className="tnum">{widget.devCode}</strong>.
              </>
            ) : (
              <>
                We sent a 6-digit code to <span className="tnum font-medium">{display}</span>.
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          className="text-[12px] font-semibold text-(--color-accent) underline"
          onClick={onReset}
        >
          {PHONE_TEXT.changeNumber}
        </button>
      </div>

      <div className="my-[16px]">
        <OtpInput
          id="otp"
          value={code}
          onChange={onCodeChange}
          invalid={failed}
          disabled={pending || exhausted}
          autoFocus
          label={PHONE_TEXT.otpLabel}
        />
      </div>

      <Captcha id={captchaId} />

      <div className="flex flex-wrap items-center justify-between gap-[8px] text-[12px]">
        <span className="tnum ink-secondary">
          {remaining > 0 ? PHONE_TEXT.resendIn(countdown(remaining)) : ''}
        </span>
        <button
          type="button"
          className="font-semibold text-(--color-accent) underline disabled:no-underline disabled:opacity-45"
          disabled={pending || remaining > 0}
          onClick={onResend}
        >
          {PHONE_TEXT.resend}
        </button>
      </div>

      <div className="mt-[16px] flex flex-wrap gap-[8px]">
        <Button
          variant="primary"
          size="md"
          loading={pending}
          disabled={code.length < OTP_DIGITS || exhausted}
          onClick={onVerify}
        >
          {PHONE_TEXT.verifyAndContinue}
        </Button>
        <Button variant="secondary" size="md" onClick={onReset}>
          {PHONE_TEXT.cancel}
        </Button>
      </div>
    </section>
  );
}
