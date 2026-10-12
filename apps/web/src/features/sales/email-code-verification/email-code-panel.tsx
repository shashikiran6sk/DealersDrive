'use client';

import { ASSISTED_EMAIL_CODE_LENGTH } from '@dealers-drive/contracts';

import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import { countdown } from '@/features/auth/phone-verification';

import { EMAIL_CODE_TEXT } from './email-code-verification.constants';
import type { EmailCodePanelProps } from './email-code-verification.types';

export function EmailCodePanel({
  codeId,
  email,
  code,
  onCodeChange,
  failed,
  message,
  notice,
  remaining,
  pending,
  disabled,
  onVerify,
  onResend,
  onChangeEmail,
}: EmailCodePanelProps) {
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
        if (code.length === ASSISTED_EMAIL_CODE_LENGTH) onVerify();
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-[8px]">
        <div className="min-w-0">
          <h3
            className={`text-[15px] font-semibold ${failed ? 'text-(--color-err)' : 'text-(--color-accent-800)'}`}
          >
            {failed ? EMAIL_CODE_TEXT.failedTitle : EMAIL_CODE_TEXT.codeTitle}
          </h3>
          <p className="mt-[2px] text-[13px] break-words ink-body" aria-live="polite">
            {EMAIL_CODE_TEXT.sentTo(email)}
          </p>
          {message ? (
            <p role="alert" className="mt-[4px] text-[13px] text-(--color-err)">
              {message}
            </p>
          ) : notice ? (
            <p className="mt-[4px] text-[12px] ink-body">{notice}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="text-[12px] font-semibold text-(--color-accent) underline disabled:no-underline disabled:opacity-45"
          disabled={pending || disabled}
          onClick={onChangeEmail}
        >
          {EMAIL_CODE_TEXT.changeEmail}
        </button>
      </div>

      <div className="my-[16px]">
        <OtpInput
          id={codeId}
          value={code}
          onChange={onCodeChange}
          length={ASSISTED_EMAIL_CODE_LENGTH}
          invalid={failed}
          disabled={pending || disabled}
          label={EMAIL_CODE_TEXT.codeLabel}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-[8px] text-[12px]">
        <span className="tnum ink-secondary">
          {remaining > 0 ? EMAIL_CODE_TEXT.resendIn(countdown(remaining)) : ''}
        </span>
        <button
          type="button"
          className="font-semibold text-(--color-accent) underline disabled:no-underline disabled:opacity-45"
          disabled={pending || disabled || remaining > 0}
          onClick={onResend}
        >
          {EMAIL_CODE_TEXT.resend}
        </button>
      </div>

      <div className="mt-[16px] flex flex-wrap gap-[8px]">
        <Button
          variant="primary"
          size="md"
          loading={pending}
          disabled={disabled || code.length < ASSISTED_EMAIL_CODE_LENGTH}
          onClick={onVerify}
        >
          {EMAIL_CODE_TEXT.verify}
        </Button>
      </div>
    </section>
  );
}
