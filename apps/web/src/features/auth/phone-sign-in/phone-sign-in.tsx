'use client';

import { formatPhone, isIndianMobile } from '@dealers-drive/contracts';
import { useEffect, useId, useRef, useState, useTransition } from 'react';

import { Field, invalidProps } from '@/components/forms/field';
import { GetOtpButton } from '@/components/auth/get-otp-button';
import {
  Captcha,
  isServiceFailure,
  LOCAL_ATTEMPTS,
  OTP_DIGITS,
  PHONE_TEXT,
  PhoneCodePanel,
  PhoneUnavailable,
  RESEND_SECONDS,
} from '@/features/auth/phone-verification';
import { phoneOtpToken, sendPhoneOtp } from '@/lib/phone-otp';

import { PHONE_SIGN_IN_TEXT } from './phone-sign-in.constants';
import type { PhoneSignInProps, PhoneSignInStage } from './phone-sign-in.types';

export function PhoneSignIn({
  widget,
  idPrefix,
  onProved,
  verifyLabel = PHONE_SIGN_IN_TEXT.verify,
  initialStage = 'number',
  initialPhone = '',
}: PhoneSignInProps) {
  const captchaId = useId();
  const phoneId = `${idPrefix}-phone`;
  const [stage, setStage] = useState<PhoneSignInStage>(initialStage);
  const [phone, setPhone] = useState(initialPhone);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(LOCAL_ATTEMPTS);
  const [resendAt, setResendAt] = useState(0);
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

  if (!widget?.enabled) {
    return (
      <PhoneUnavailable
        reason={widget?.reason ?? undefined}
        tail={PHONE_SIGN_IN_TEXT.unavailableTail}
      />
    );
  }
  const ready = widget;

  async function send(resend: boolean): Promise<void> {
    if (busy.current) return;
    if (!isIndianMobile(phone)) {
      setPhoneError(PHONE_SIGN_IN_TEXT.invalidPhone);
      return;
    }
    if (resend && remaining > 0) return;

    busy.current = true;
    setPhoneError(null);
    setFailure(null);
    try {
      await sendPhoneOtp(ready, phone, { resend, captchaRenderId: captchaId });
      setCode('');
      setAttemptsLeft(LOCAL_ATTEMPTS);
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
      setStage('code');
    } catch (error) {
      const message = isServiceFailure(error) ? error.message : PHONE_TEXT.sendFailed;
      if (resend) {
        setFailure(message);
        setStage('failed');
      } else {
        setPhoneError(message);
      }
    } finally {
      busy.current = false;
    }
  }

  async function verify(): Promise<void> {
    if (busy.current || code.length < OTP_DIGITS) return;
    busy.current = true;
    setFailure(null);
    try {
      const accessToken = await phoneOtpToken(ready, phone, code);
      const refused = await onProved(phone, accessToken);
      if (refused) refuse(refused);
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

  if (stage === 'number') {
    return (
      <form
        className="flex flex-col gap-[14px]"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            await send(false);
          });
        }}
      >
        <Field
          id={phoneId}
          label={PHONE_SIGN_IN_TEXT.phoneLabel}
          hint={PHONE_SIGN_IN_TEXT.phoneHint}
          error={phoneError ?? undefined}
        >
          <input
            id={phoneId}
            name="phone"
            className="input tnum"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder={PHONE_SIGN_IN_TEXT.phonePlaceholder}
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              setPhoneError(null);
            }}
            required
            aria-required="true"
            {...invalidProps(phoneId, phoneError ?? undefined)}
          />
        </Field>
        <Captcha id={captchaId} />
        <GetOtpButton type="submit" channel={ready.channel} loading={pending} />
      </form>
    );
  }

  return (
    <PhoneCodePanel
      captchaId={captchaId}
      widget={ready}
      display={formatPhone(phone)}
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
      verifyLabel={verifyLabel}
      onVerify={() => {
        startTransition(async () => {
          await verify();
        });
      }}
      onResend={() => {
        startTransition(async () => {
          await send(true);
        });
      }}
      onReset={() => {
        setStage('number');
        setFailure(null);
        setCode('');
      }}
    />
  );
}
