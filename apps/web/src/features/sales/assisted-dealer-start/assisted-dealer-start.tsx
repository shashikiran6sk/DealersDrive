'use client';

import { IndianMobile, formatPhone } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Field, invalidProps } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PhoneVerification } from '@/features/auth/phone-verification';
import { AssistedConsent } from '@/features/sales/assisted-consent';
import { AssistedDealerForm } from '@/features/sales/assisted-dealer-form';
import { ASSISTED_FORM_TEXT } from '@/features/sales/assisted-dealer-form/assisted-dealer-form.constants';
import { EmailCodeVerification } from '@/features/sales/email-code-verification';
import {
  createAssistedDealerAction,
  verifyDealerPhoneAction,
} from '@/features/sales/sales-actions';

import { START_TEXT } from './assisted-dealer-start.constants';
import type { AssistedDealerStartProps } from './assisted-dealer-start.types';

export function AssistedDealerStart({ widget, initialVerified }: AssistedDealerStartProps) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialVerified?.phone ?? '');
  const [consent, setConsent] = useState(initialVerified !== undefined);
  const [phoneTicket, setPhoneTicket] = useState<string | null>(
    initialVerified?.phoneTicket ?? null,
  );
  const [phoneDisplay, setPhoneDisplay] = useState<string | null>(null);
  const [email, setEmail] = useState(initialVerified?.email ?? '');
  const [emailTicket, setEmailTicket] = useState<string | null>(
    initialVerified?.emailTicket ?? null,
  );
  const [round, setRound] = useState(0);
  const [details, setDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedValues, setSavedValues] = useState<Record<string, string>>({});
  const [savedServices, setSavedServices] = useState<string[]>([]);

  if (details && phoneTicket && emailTicket) {
    return (
      <section aria-labelledby="assisted-details-heading" className="flex flex-col gap-4">
        <h2 id="assisted-details-heading" className="text-[13px] font-bold uppercase ink-muted">
          {START_TEXT.stepDetails}
        </h2>
        <p className="text-[13px] ink-body">
          {START_TEXT.verifiedSummary(phoneDisplay ?? formatPhone(phone), email)}
        </p>
        <p className="text-[12px] ink-muted">{START_TEXT.ticketNote}</p>
        <AssistedDealerForm
          initial={savedValues}
          initialServices={savedServices}
          submitLabel={ASSISTED_FORM_TEXT.saveAndContinue}
          partial={false}
          onSubmit={(values) => {
            const saved: Record<string, string> = {};
            for (const [name, value] of Object.entries(values)) {
              if (typeof value === 'string') saved[name] = value;
            }
            setSavedValues(saved);
            if (Array.isArray(values.specialities)) {
              setSavedServices(
                values.specialities.filter((value): value is string => typeof value === 'string'),
              );
            }
            return createAssistedDealerAction({ ...values, phoneTicket, emailTicket });
          }}
          onDone={(result) => {
            if (result.dealerId) router.push(`/sales/dealers/${result.dealerId}/documents`);
          }}
        />
        <div className="flex flex-col items-start gap-2">
          <p className="text-[12px] ink-muted">{START_TEXT.reverifyHint}</p>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => {
              setPhoneTicket(null);
              setEmailTicket(null);
              setRound((value) => value + 1);
              setDetails(false);
            }}
          >
            {START_TEXT.reverify}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="assisted-verify-heading"
      className="flex max-w-[560px] flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="assisted-verify-heading" className="text-[13px] font-bold uppercase ink-muted">
          {START_TEXT.stepVerify}
        </h2>
        <p className="text-[13px] ink-body">{START_TEXT.verifyIntro}</p>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <Field
          id="assisted-phone"
          label={START_TEXT.phoneLabel}
          hint={START_TEXT.phoneHint}
          error={error ?? undefined}
        >
          <Input
            id="assisted-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            placeholder={START_TEXT.phonePlaceholder}
            value={phone}
            readOnly={phoneTicket !== null}
            onChange={(event) => setPhone(event.target.value)}
            {...invalidProps('assisted-phone', error ?? undefined)}
          />
        </Field>

        <AssistedConsent
          id="assisted-consent"
          checked={consent}
          disabled={phoneTicket !== null}
          onChange={setConsent}
        />

        <PhoneVerification
          widget={widget}
          phone={phone}
          fullName={START_TEXT.linkedTo}
          verified={phoneTicket !== null}
          verifiedTitle={START_TEXT.verifiedTitle}
          checkAvailability={null}
          verifyAction={(value, token) => verifyDealerPhoneAction(value, token, consent)}
          onBeforeSend={() => {
            if (!IndianMobile.safeParse(phone).success) {
              setError(START_TEXT.phoneInvalid);
              return false;
            }
            if (!consent) {
              setError(START_TEXT.consentMissing);
              return false;
            }
            setError(null);
            return true;
          }}
          onVerified={(_value, result) => {
            setPhoneTicket(result.phoneTicket ?? null);
            setPhoneDisplay(result.phoneDisplay ?? null);
          }}
        />
      </form>

      <EmailCodeVerification
        key={round}
        initialEmail={email}
        initialStage={emailTicket ? 'verified' : 'email'}
        onVerified={(result) => {
          setEmail(result.email);
          setEmailTicket(result.emailTicket);
        }}
      />

      {phoneTicket && emailTicket ? (
        <div>
          <Button type="button" variant="primary" size="md" onClick={() => setDetails(true)}>
            {START_TEXT.continue}
          </Button>
        </div>
      ) : (
        <p className="text-[12px] ink-muted">{START_TEXT.bothNeeded}</p>
      )}
    </section>
  );
}
