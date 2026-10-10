'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminPhoneChallengeResponse, PhoneOtpWidget } from '@dealers-drive/contracts';
import { PhoneSignIn } from '@/features/auth/phone-sign-in';
import { Banner } from '@/components/ui/primitives';
import { startAdminPhoneChallenge, verifyAdminPhone } from './actions';

export function AdminPhone({
  mode,
  widget,
}: {
  mode: 'LOGIN' | 'ENROLL';
  widget: PhoneOtpWidget | null;
}) {
  const challenge = useRef<AdminPhoneChallengeResponse | null>(null);
  const [linked, setLinked] = useState(false);
  const router = useRouter();
  if (linked)
    return (
      <Banner tone="ok">
        Mobile number verified and linked. You can use it for admin sign-in.
      </Banner>
    );
  return (
    <PhoneSignIn
      widget={widget}
      idPrefix={`admin-${mode.toLowerCase()}`}
      verifyLabel={mode === 'LOGIN' ? 'Verify and sign in' : 'Verify and link mobile'}
      onBeforeSend={async (phone) => {
        const result = await startAdminPhoneChallenge(mode, phone);
        challenge.current = result.challenge ?? null;
        return result.error ?? null;
      }}
      onProved={async (_phone, accessToken) => {
        const current = challenge.current;
        if (!current || Date.parse(current.expiresAt) <= Date.now())
          return 'This request has expired. Start again.';
        const result = await verifyAdminPhone(mode, {
          challengeId: current.challengeId,
          browserToken: current.browserToken,
          accessToken,
        });
        if (result.error) return result.error;
        if (mode === 'ENROLL') {
          setLinked(true);
          router.refresh();
        }
        return null;
      }}
    />
  );
}
