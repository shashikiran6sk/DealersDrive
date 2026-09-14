'use client';

import { formatPhone, type PhoneOtpWidget } from '@dealers-drive/contracts';
import { useEffect, useId, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import { StatusTag } from '@/components/ui/primitives';
import { checkPhoneAvailabilityAction, verifyPhoneAction } from '@/features/auth/phone-actions';
import { loadMsg91Widget, retryMsg91Otp, sendMsg91Otp, verifyMsg91Otp } from '@/lib/msg91-widget';

export type PhoneStage = 'idle' | 'code' | 'failed';

const RESEND_SECONDS = 30;

const LOCAL_ATTEMPTS = 3;

const WRONG_CODE = 'That code is not right. Check the SMS, or ask for a new one.';

export interface PhoneVerificationProps {
  widget: PhoneOtpWidget | null;
  phone: string;
  fullName: string;
  verified: boolean;
  onVerified: (phone: string) => void;
  onContinue: () => void;
  onBeforeSend: (form: HTMLFormElement | null) => boolean;
  onRefused?: (message: string) => void;
  initialStage?: PhoneStage;
}

export function PhoneVerification({
  widget,
  phone,
  fullName,
  verified,
  onVerified,
  onContinue,
  onBeforeSend,
  onRefused,
  initialStage = 'idle',
}: PhoneVerificationProps) {
  const captchaId = useId();
  const [stage, setStage] = useState<PhoneStage>(initialStage);
  const [code, setCode] = useState('');
  const [failure, setFailure] = useState<string | null>(
    initialStage === 'failed' ? WRONG_CODE : null,
  );
  const [attemptsLeft, setAttemptsLeft] = useState(
    initialStage === 'failed' ? LOCAL_ATTEMPTS - 1 : LOCAL_ATTEMPTS,
  );
  const [resendAt, setResendAt] = useState(() =>
    initialStage === 'idle' ? 0 : Date.now() + RESEND_SECONDS * 1000,
  );
  const [remaining, setRemaining] = useState(0);
  const [pending, startTransition] = useTransition();

  const busy = useRef(false);

  useEffect(() => {
    const tick = (): void => {
      setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [resendAt]);

  const enabled = widget?.enabled ?? false;
  const display = formatPhone(phone);

  async function send(form: HTMLFormElement | null, resend: boolean): Promise<void> {
    if (busy.current || !enabled || !widget) return;
    if (!resend && !onBeforeSend(form)) return;
    if (resend && remaining > 0) return;

    busy.current = true;
    setFailure(null);
    try {
      if (!resend) {
        const available = await checkPhoneAvailabilityAction(phone);
        if (available.error) {
          if (onRefused) onRefused(available.error);
          else setFailure(available.error);
          setStage('idle');
          return;
        }
      }

      if (widget.driver === 'msg91') {
        await loadMsg91Widget({
          widgetId: widget.widgetId ?? '',
          tokenAuth: widget.tokenAuth ?? '',
          captchaRenderId: captchaId,
        });
        if (resend) await retryMsg91Otp(identifierOf(phone));
        else await sendMsg91Otp(identifierOf(phone));
      }

      setCode('');
      setAttemptsLeft(LOCAL_ATTEMPTS);
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
      setStage('code');
    } catch (error) {
      setFailure(
        error instanceof Error && error.message.startsWith('The verification service')
          ? error.message
          : 'We could not send a code to that number. Check it and try again.',
      );
      setStage(resend ? 'failed' : 'idle');
    } finally {
      busy.current = false;
    }
  }

  async function verify(entered: string): Promise<void> {
    if (busy.current || entered.length < 6 || !widget) return;
    busy.current = true;
    setFailure(null);

    try {
      const accessToken =
        widget.driver === 'msg91'
          ? await verifyMsg91Otp(entered)
          : `dev-otp:${identifierOf(phone)}:${entered}:${String(Date.now())}`;

      const result = await verifyPhoneAction(phone, accessToken);

      if (!result.verified) {
        refuse(result.error ?? WRONG_CODE);
        return;
      }

      setStage('idle');
      setCode('');
      onVerified(result.phone ?? phone);
    } catch (error) {
      refuse(
        error instanceof Error && error.message.startsWith('The verification service')
          ? error.message
          : WRONG_CODE,
      );
    } finally {
      busy.current = false;
    }
  }

  function refuse(message: string): void {
    setAttemptsLeft((left) => Math.max(0, left - 1));
    setFailure(message);
    setStage('failed');
  }

  function reset(): void {
    setStage('idle');
    setFailure(null);
    setCode('');
  }

  if (!enabled) {
    return (
      <section
        role="status"
        className="border border-[color-mix(in_srgb,#a15c00_30%,transparent)] bg-(--color-warn-bg) px-[16px] py-[14px] text-[13px]"
      >
        <p className="font-semibold text-(--color-warn)">Mobile verification is unavailable</p>
        <p className="mt-[4px] ink-body">
          {widget?.reason ?? 'We could not reach the verification service.'} Your dealership cannot
          be set up until this number is confirmed — please try again in a few minutes.
        </p>
      </section>
    );
  }

  if (verified) {
    return (
      <section
        aria-live="polite"
        className="border border-[color-mix(in_srgb,#0f7a5a_30%,transparent)] bg-(--color-ok-bg) px-[18px] py-[16px]"
      >
        <div className="flex flex-wrap items-center gap-[12px]">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-(--color-ok)">Mobile number verified</h2>
            <p className="mt-[2px] text-[13px] ink-body">
              <span className="tnum font-medium">{display}</span> has been linked to{' '}
              <span className="font-medium">{fullName.trim() || 'your account'}</span>.
            </p>
          </div>
          <StatusTag tone="ok">Verified</StatusTag>
        </div>

        <div className="mt-[16px] flex flex-wrap items-center justify-between gap-[10px] border-t border-[color-mix(in_srgb,#0f7a5a_30%,transparent)] pt-[14px]">
          <span className="text-[12px] ink-secondary">Next: your dealership’s details</span>
          <Button variant="primary" size="md" onClick={onContinue}>
            Continue to business details
          </Button>
        </div>
      </section>
    );
  }

  if (stage === 'idle') {
    return (
      <>
        <Captcha id={captchaId} />
        {failure ? (
          <p role="alert" className="mb-[10px] text-[12px] text-(--color-err)">
            {failure}
          </p>
        ) : null}
        <Button
          variant="primary"
          size="md"
          block
          loading={pending}
          onClick={(event) => {
            const form = event.currentTarget.form;
            startTransition(async () => {
              await send(form, false);
            });
          }}
        >
          Send OTP
        </Button>
      </>
    );
  }

  const failed = stage === 'failed';
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
        if (code.length === 6 && !exhausted) {
          startTransition(async () => {
            await verify(code);
          });
        }
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-[8px]">
        <div className="min-w-0">
          <h2
            className={`text-[15px] font-semibold ${failed ? 'text-(--color-err)' : 'text-(--color-accent-800)'}`}
          >
            {failed ? 'That code did not match' : 'Verify your mobile number'}
          </h2>
          <p className="mt-[2px] text-[13px] ink-body" aria-live="polite">
            {failed ? (
              <>
                {failure}{' '}
                {exhausted ? (
                  <strong>Ask for a new code to try again.</strong>
                ) : (
                  <>
                    <strong className="tnum">{attemptsLeft}</strong>{' '}
                    {attemptsLeft === 1 ? 'attempt' : 'attempts'} left before you need a new one.
                  </>
                )}
              </>
            ) : widget?.driver === 'fake' ? (
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
          onClick={reset}
        >
          Change number
        </button>
      </div>

      <div className="my-[16px]">
        <OtpInput
          id="otp"
          value={code}
          onChange={(next) => {
            setCode(next);
            if (failed && next.length < 6) setStage('code');
          }}
          invalid={failed}
          disabled={pending || exhausted}
          autoFocus
          label="6-digit verification code"
        />
      </div>

      <Captcha id={captchaId} />

      <div className="flex flex-wrap items-center justify-between gap-[8px] text-[12px]">
        <span className="tnum ink-secondary">
          {remaining > 0 ? `You can ask for a new code in ${countdown(remaining)}` : ''}
        </span>
        <button
          type="button"
          className="font-semibold text-(--color-accent) underline disabled:no-underline disabled:opacity-45"
          disabled={pending || remaining > 0}
          onClick={() => {
            startTransition(async () => {
              await send(null, true);
            });
          }}
        >
          Resend code
        </button>
      </div>

      <div className="mt-[16px] flex flex-wrap gap-[8px]">
        <Button
          variant="primary"
          size="md"
          loading={pending}
          disabled={code.length < 6 || exhausted}
          onClick={() => {
            startTransition(async () => {
              await verify(code);
            });
          }}
        >
          Verify &amp; continue
        </Button>
        <Button variant="secondary" size="md" onClick={reset}>
          Cancel
        </Button>
      </div>
    </section>
  );
}

function identifierOf(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('91') && digits.length > 10 ? digits : `91${digits}`;
}

function Captcha({ id }: { id: string }) {
  return <div id={id} className="mb-[12px] empty:hidden" />;
}

function countdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
