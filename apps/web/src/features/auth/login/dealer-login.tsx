'use client';

import { useRouter } from 'next/navigation';

import { GoogleSignInButton } from '@/components/auth/google-button';
import { Banner } from '@/components/ui/primitives';
import { PhoneSignIn } from '@/features/auth/phone-sign-in';
import { dealerPhoneSignInAction } from '@/features/auth/sign-in-actions';

import { DEALER_LOGIN_ERRORS, DEALER_LOGIN_FALLBACK_ERROR, LOGIN_TEXT } from './login.constants';
import type { DealerLoginProps } from './login.types';

export function DealerLogin({ widget, google, returnTo, error }: DealerLoginProps) {
  const router = useRouter();

  return (
    <section aria-labelledby="dealer-login-heading">
      <h2 id="dealer-login-heading" className="font-heading text-[20px] font-semibold">
        {LOGIN_TEXT.dealerHeading}
      </h2>
      <p className="mb-[18px] mt-[6px] text-[14px] leading-[1.5] ink-secondary">
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

      <GoogleSignInButton href={google.href} disabled={!google.enabled} />

      <div className="my-[20px] flex items-center gap-[12px] text-[12px] uppercase tracking-[0.1em] ink-subtle">
        <span className="h-px flex-1 bg-(--color-divider)" />
        {LOGIN_TEXT.or}
        <span className="h-px flex-1 bg-(--color-divider)" />
      </div>

      <PhoneSignIn
        widget={widget}
        idPrefix="dealer"
        onProved={async (phone, accessToken) => {
          const result = await dealerPhoneSignInAction(phone, accessToken, returnTo ?? undefined);
          if (result.error) return result.error;
          router.replace(result.returnTo ?? '/dealer');
          router.refresh();
          return null;
        }}
      />
    </section>
  );
}
