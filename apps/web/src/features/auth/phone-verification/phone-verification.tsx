'use client';

import { formatPhone } from '@dealers-drive/contracts';
import { useEffect, useId, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { checkPhoneAvailabilityAction, verifyPhoneAction } from '@/features/auth/phone-actions';
import { loadMsg91Widget, retryMsg91Otp, sendMsg91Otp, verifyMsg91Otp } from '@/lib/msg91-widget';

import { Captcha } from './captcha';
import { PhoneCodePanel } from './phone-code-panel';
import { PhoneUnavailable } from './phone-unavailable';
import { PhoneVerified } from './phone-verified';
import {
  LOCAL_ATTEMPTS,
  OTP_DIGITS,
  PHONE_TEXT,
  RESEND_SECONDS,
} from './phone-verification.constants';
import type { PhoneStage, PhoneVerificationProps } from './phone-verification.types';
import { identifierOf, isServiceFailure } from './utils';

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
    initialStage === 'failed' ? PHONE_TEXT.wrongCode : null,
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
      setFailure(isServiceFailure(error) ? error.message : PHONE_TEXT.sendFailed);
      setStage(resend ? 'failed' : 'idle');
    } finally {
      busy.current = false;
    }
  }

  async function verify(entered: string): Promise<void> {
    if (busy.current || entered.length < OTP_DIGITS || !widget) return;
    busy.current = true;
    setFailure(null);

    try {
      const accessToken =
        widget.driver === 'msg91'
          ? await verifyMsg91Otp(entered)
          : `dev-otp:${identifierOf(phone)}:${entered}:${String(Date.now())}`;

      const result = await verifyPhoneAction(phone, accessToken);

      if (!result.verified) {
        refuse(result.error ?? PHONE_TEXT.wrongCode);
        return;
      }

      setStage('idle');
      setCode('');
      onVerified(result.phone ?? phone);
    } catch (error) {
      refuse(isServiceFailure(error) ? error.message : PHONE_TEXT.wrongCode);
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

  if (!widget?.enabled) return <PhoneUnavailable reason={widget?.reason ?? undefined} />;

  if (verified) {
    return <PhoneVerified display={display} fullName={fullName} onContinue={onContinue} />;
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
          {PHONE_TEXT.sendOtp}
        </Button>
      </>
    );
  }

  return (
    <PhoneCodePanel
      captchaId={captchaId}
      widget={widget}
      display={display}
      code={code}
      onCodeChange={(next) => {
        setCode(next);
        if (stage === 'failed' && next.length < OTP_DIGITS) setStage('code');
      }}
      failed={stage === 'failed'}
      failure={failure}
      attemptsLeft={attemptsLeft}
      remaining={remaining}
      pending={pending}
      onVerify={() => {
        startTransition(async () => {
          await verify(code);
        });
      }}
      onResend={() => {
        startTransition(async () => {
          await send(null, true);
        });
      }}
      onReset={reset}
    />
  );
}
