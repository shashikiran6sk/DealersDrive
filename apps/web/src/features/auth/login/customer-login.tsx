'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PhoneSignIn } from '@/features/auth/phone-sign-in';
import { customerPhoneSignInAction } from '@/features/auth/sign-in-actions';

import { CustomerNameStep } from './customer-name-step';
import { LOGIN_TEXT } from './login.constants';
import type { CustomerLoginProps } from './login.types';

export function CustomerLogin({ widget, returnTo }: CustomerLoginProps) {
  const router = useRouter();
  const [phoneDisplay, setPhoneDisplay] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  function finish(): void {
    router.replace(returnTo);
    router.refresh();
  }

  return (
    <section aria-labelledby="customer-login-heading">
      <h2
        id="customer-login-heading"
        className="font-heading text-[28px] font-extrabold tracking-[-0.035em] sm:text-[30px]"
      >
        {LOGIN_TEXT.customerHeading}
      </h2>
      <p className="mb-[20px] mt-[8px] text-[14px] leading-[1.6] ink-muted">
        {LOGIN_TEXT.customerIntro}
      </p>

      {phoneDisplay ? (
        <CustomerNameStep
          phoneDisplay={phoneDisplay}
          onCreated={finish}
          onRestart={() => {
            setPhoneDisplay(null);
            setAttempt((count) => count + 1);
          }}
        />
      ) : (
        <PhoneSignIn
          key={attempt}
          widget={widget}
          idPrefix="customer"
          onProved={async (phone, accessToken) => {
            const result = await customerPhoneSignInAction(phone, accessToken);
            if (result.error) return result.error;
            if (result.status === 'NAME_REQUIRED') {
              setPhoneDisplay(result.phoneDisplay ?? phone);
              return null;
            }
            finish();
            return null;
          }}
        />
      )}
    </section>
  );
}
