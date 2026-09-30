'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { GoogleSignInButton } from '@/components/auth/google-button';
import { Banner } from '@/components/ui/primitives';
import { PhoneSignIn } from '@/features/auth/phone-sign-in';
import { dealerPhoneSignInAction } from '@/features/auth/sign-in-actions';

import { DEALER_LOGIN_ERRORS, DEALER_LOGIN_FALLBACK_ERROR, LOGIN_TEXT } from './login.constants';
import type { DealerLoginProps } from './login.types';

const DEALER_PHONE_PANEL = 'dealer-phone-panel';

export function DealerLogin({
  widget,
  google,
  returnTo,
  error,
  whatsappOtp = false,
}: DealerLoginProps) {
  const router = useRouter();
  const [phoneOpen, setPhoneOpen] = useState(!google.enabled);
  const revealed = useRef(false);

  useEffect(() => {
    if (!revealed.current) return;
    document.getElementById('dealer-phone')?.focus();
  }, [phoneOpen]);

  return (
    <section aria-labelledby="dealer-login-heading">
      <h2
        id="dealer-login-heading"
        className="font-heading text-[28px] font-extrabold tracking-[-0.035em] sm:text-[30px]"
      >
        {LOGIN_TEXT.dealerHeading}
      </h2>
      <p className="mb-[20px] mt-[8px] text-[14px] leading-[1.6] ink-muted">
        {LOGIN_TEXT.dealerIntro}
      </p>

      {error ? (
        <Banner tone="err" className="mb-[18px]">
          {DEALER_LOGIN_ERRORS[error] ?? DEALER_LOGIN_FALLBACK_ERROR}
        </Banner>
      ) : null}

      {google.enabled ? null : (
        <Banner tone="warn" title={LOGIN_TEXT.googleUnavailable} className="mb-[18px]">
          {google.reason}
        </Banner>
      )}

      <GoogleSignInButton href={google.href} disabled={!google.enabled} variant="primary" />

      {phoneOpen ? null : (
        <button
          type="button"
          aria-expanded={false}
          aria-controls={DEALER_PHONE_PANEL}
          className="mx-auto mt-[14px] flex min-h-[40px] items-center text-[13px] font-bold underline underline-offset-[3px]"
          onClick={() => {
            revealed.current = true;
            setPhoneOpen(true);
          }}
        >
          {LOGIN_TEXT.usePhoneInstead}
        </button>
      )}

      <div id={DEALER_PHONE_PANEL} hidden={!phoneOpen}>
        <div className="my-[20px] flex items-center gap-[12px] text-[12px] font-bold uppercase tracking-[0.1em] ink-subtle">
          <span className="h-px flex-1 bg-(--color-divider)" />
          {LOGIN_TEXT.or}
          <span className="h-px flex-1 bg-(--color-divider)" />
        </div>

        <PhoneSignIn
          widget={widget}
          idPrefix="dealer"
          whatsappOtp={whatsappOtp}
          onProved={async (phone, accessToken) => {
            const result = await dealerPhoneSignInAction(phone, accessToken, returnTo ?? undefined);
            if (result.error) return result.error;
            router.replace(result.returnTo ?? '/dealer');
            router.refresh();
            return null;
          }}
        />
      </div>
    </section>
  );
}
