'use client';

import { useLegalEnabled } from '@/features/legal/legal-provider';
import { formatPhone } from '@dealers-drive/contracts';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { checkPhoneAvailabilityAction, verifyPhoneAction } from '@/features/auth/phone-actions';
import { phoneOtpToken, sendPhoneOtp } from '@/lib/phone-otp';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

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
import { isServiceFailure } from './utils';

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
  verifyAction = verifyPhoneAction,
  checkAvailability = checkPhoneAvailabilityAction,
  verifiedTitle,
  continueLabel,
}: PhoneVerificationProps) {
  const captchaId = useId();
  const legal = useLegalEnabled();
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
  const [pending, startTransition] = useNavigationSafeAction();
  const [accountsLinked, setAccountsLinked] = useState(false);

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
      if (!resend && checkAvailability) {
        const available = await checkAvailability(phone);
        if (available.error) {
          if (onRefused) onRefused(available.error);
          else setFailure(available.error);
          setStage('idle');
          return;
        }
      }

      await sendPhoneOtp(widget, phone, { resend, captchaRenderId: captchaId });

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
      const accessToken = await phoneOtpToken(widget, phone, entered);

      const result = await verifyAction(phone, accessToken);

      if (!result.verified) {
        refuse(result.error ?? PHONE_TEXT.wrongCode);
        return;
      }

      setStage('idle');
      setCode('');
      setAccountsLinked(result.accountsLinked === true);
      onVerified(result.phone ?? phone, result);
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
    return (
      <PhoneVerified
        display={display}
        fullName={fullName}
        accountsLinked={accountsLinked}
        onContinue={onContinue}
        {...(verifiedTitle ? { title: verifiedTitle } : {})}
        {...(continueLabel ? { continueLabel } : {})}
      />
    );
  }

  if (stage === 'idle') {
    return (
      <>
        {legal ? (
          <p className="mb-3 text-[12px] leading-[1.7]">
            Your mobile number and verification details are used to verify access through our phone
            verification service. OTP verification does not permit marketing.{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
              Privacy Policy (opens in a new tab)
            </a>
            .
          </p>
        ) : null}
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
