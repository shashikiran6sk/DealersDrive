'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Field, invalidProps } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banner } from '@/components/ui/primitives';
import { PhoneVerification } from '@/features/auth/phone-verification';
import { AssistedConsent } from '@/features/sales/assisted-consent';
import { EmailCodeVerification } from '@/features/sales/email-code-verification';
import {
  verifyAssistedDealerOwnerAction,
  verifyDealerPhoneAction,
} from '@/features/sales/sales-actions';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

import { VERIFY_OWNER_TEXT } from './verify-owner-panel.constants';
import type { VerifyOwnerPanelProps } from './verify-owner-panel.types';

export function VerifyOwnerPanel({ dealerId, phone, phoneDisplay, widget }: VerifyOwnerPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useNavigationSafeAction();
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [phoneTicket, setPhoneTicket] = useState<string | null>(null);
  const [emailTicket, setEmailTicket] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <div className="flex max-w-[560px] flex-col gap-4">
      <p className="text-[13px] ink-body">{VERIFY_OWNER_TEXT.intro}</p>

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <Field
          id="verify-owner-phone"
          label={VERIFY_OWNER_TEXT.phoneLabel}
          hint={VERIFY_OWNER_TEXT.phoneHint}
          error={consentError ?? undefined}
        >
          <Input
            id="verify-owner-phone"
            type="tel"
            value={phoneDisplay}
            readOnly
            {...invalidProps('verify-owner-phone', consentError ?? undefined)}
          />
        </Field>

        <AssistedConsent
          id="verify-owner-consent"
          checked={consent}
          disabled={phoneTicket !== null || done}
          onChange={setConsent}
        />

        <PhoneVerification
          widget={widget}
          phone={phone}
          fullName={VERIFY_OWNER_TEXT.linkedTo}
          verified={phoneTicket !== null}
          verifiedTitle={VERIFY_OWNER_TEXT.verifiedTitle}
          checkAvailability={null}
          verifyAction={(value, token) => verifyDealerPhoneAction(value, token, consent)}
          onBeforeSend={() => {
            if (!consent) {
              setConsentError(VERIFY_OWNER_TEXT.consentMissing);
              return false;
            }
            setConsentError(null);
            return true;
          }}
          onVerified={(_value, result) => {
            setPhoneTicket(result.phoneTicket ?? null);
          }}
        />
      </form>

      <EmailCodeVerification
        disabled={done}
        onVerified={(result) => {
          setEmailTicket(result.emailTicket);
        }}
      />

      {message ? <Banner tone="err">{message}</Banner> : null}
      {done ? <Banner tone="ok">{VERIFY_OWNER_TEXT.done}</Banner> : null}

      {phoneTicket && emailTicket ? null : (
        <p className="text-[12px] ink-muted">{VERIFY_OWNER_TEXT.bothNeeded}</p>
      )}

      <div>
        <Button
          type="button"
          variant="primary"
          size="md"
          loading={pending}
          disabled={!phoneTicket || !emailTicket || done}
          onClick={() => {
            if (!phoneTicket || !emailTicket) return;
            setMessage(null);
            startTransition(async () => {
              const result = await verifyAssistedDealerOwnerAction(dealerId, {
                phoneTicket,
                emailTicket,
              });
              if (!result.ok) {
                setMessage(result.message ?? null);
                return;
              }
              setDone(true);
              router.refresh();
            });
          }}
        >
          {VERIFY_OWNER_TEXT.submit}
        </Button>
      </div>
    </div>
  );
}
