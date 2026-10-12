'use client';

import { ASSISTED_CONSENT_TEXT, IndianMobile, type PhoneOtpWidget } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Field, invalidProps } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PhoneVerification } from '@/features/auth/phone-verification';
import { AssistedDealerForm } from '@/features/sales/assisted-dealer-form';
import {
  createAssistedDealerAction,
  verifyDealerPhoneAction,
} from '@/features/sales/sales-actions';

import { START_TEXT } from './assisted-dealer-start.constants';

export function AssistedDealerStart({ widget }: { widget: PhoneOtpWidget | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedValues, setSavedValues] = useState<Record<string, string>>({});
  const [savedServices, setSavedServices] = useState<string[]>([]);

  if (details && ticket) {
    return (
      <section aria-labelledby="assisted-details-heading" className="flex flex-col gap-4">
        <h2 id="assisted-details-heading" className="text-[13px] font-bold uppercase ink-muted">
          {START_TEXT.stepDetails}
        </h2>
        <p className="text-[12px] ink-muted">{START_TEXT.ticketNote}</p>
        <AssistedDealerForm
          initial={savedValues}
          initialServices={savedServices}
          submitLabel={START_TEXT.create}
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
            return createAssistedDealerAction({ ...values, phoneTicket: ticket });
          }}
          onDone={(result) => {
            if (result.dealerId) router.push(`/sales/dealers/${result.dealerId}`);
          }}
        />
        <div className="flex flex-col items-start gap-2">
          <p className="text-[12px] ink-muted">{START_TEXT.reverifyHint}</p>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => {
              setTicket(null);
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
    <section aria-labelledby="assisted-phone-heading" className="flex max-w-[560px] flex-col gap-4">
      <h2 id="assisted-phone-heading" className="text-[13px] font-bold uppercase ink-muted">
        {START_TEXT.stepPhone}
      </h2>

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
            readOnly={ticket !== null}
            onChange={(event) => setPhone(event.target.value)}
            {...invalidProps('assisted-phone', error ?? undefined)}
          />
        </Field>

        <label className="flex items-start gap-3 rounded-[12px] border border-(--color-divider) bg-white p-4 text-[13px]">
          <input
            type="checkbox"
            className="mt-[3px] h-4 w-4 flex-none"
            checked={consent}
            disabled={ticket !== null}
            onChange={(event) => setConsent(event.target.checked)}
            aria-describedby="assisted-consent-text"
          />
          <span>
            <span className="block font-semibold">{START_TEXT.consentLabel}</span>
            <span id="assisted-consent-text" className="ink-body">
              {ASSISTED_CONSENT_TEXT}
            </span>
          </span>
        </label>

        <PhoneVerification
          widget={widget}
          phone={phone}
          fullName={START_TEXT.linkedTo}
          verified={ticket !== null}
          verifiedTitle={START_TEXT.verifiedTitle}
          continueLabel={START_TEXT.continue}
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
            setTicket(result.phoneTicket ?? null);
          }}
          onContinue={() => setDetails(true)}
        />
      </form>
    </section>
  );
}
