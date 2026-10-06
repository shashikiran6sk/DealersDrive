'use client';

import {
  IndianMobile,
  normaliseIndianMobile,
  type DealerClaimPreview,
  type PhoneOtpWidget,
} from '@dealers-drive/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Field, invalidProps } from '@/components/forms/field';
import { Banner } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneVerification } from '@/features/auth/phone-verification';
import { claimDealershipAction, confirmClaimEmailAction } from '@/features/claim/claim-actions';

import { CLAIM_TEXT } from './claim-dealership.constants';

export interface ClaimDealershipProps {
  token: string;
  preview: DealerClaimPreview;
  widget: PhoneOtpWidget | null;
}

export function ClaimDealership({ token, preview: initial, widget }: ClaimDealershipProps) {
  const router = useRouter();
  const [preview, setPreview] = useState(initial);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [pending, startTransition] = useTransition();

  const location = CLAIM_TEXT.location(preview.city, preview.district);
  const closed =
    preview.state === 'CLAIMED' || preview.state === 'EXPIRED' || preview.state === 'SUPERSEDED'
      ? CLAIM_TEXT.states[preview.state]
      : null;

  return (
    <section
      aria-labelledby="claim-heading"
      className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-4 py-8 md:py-12"
    >
      <div className="flex flex-col gap-1">
        <p className="text-[12px] font-bold uppercase ink-muted">{CLAIM_TEXT.eyebrow}</p>
        <h1 id="claim-heading" className="text-[26px] break-words">
          {closed && !claimed ? preview.dealerName : CLAIM_TEXT.heading(preview.dealerName)}
        </h1>
        {location ? <p className="text-[13px] ink-muted">{location}</p> : null}
        {preview.assistedBy ? (
          <p className="text-[13px] ink-body">{CLAIM_TEXT.assistedBy(preview.assistedBy)}</p>
        ) : null}
      </div>

      {closed && !claimed ? (
        <div className="flex flex-col gap-3 rounded-[14px] border border-(--color-divider) bg-white p-5">
          <h2 className="text-[17px]">{closed.title}</h2>
          <p className="text-[14px] ink-body">{closed.body}</p>
          <Link
            className="text-[14px] font-semibold"
            href={preview.state === 'CLAIMED' ? CLAIM_TEXT.signInHref : CLAIM_TEXT.homeHref}
          >
            {closed.action}
          </Link>
        </div>
      ) : null}

      {preview.state === 'AWAITING_EMAIL' ? (
        <div className="flex flex-col gap-3 rounded-[14px] border border-(--color-divider) bg-white p-5">
          <h2 className="text-[13px] font-bold uppercase ink-muted">{CLAIM_TEXT.stepEmail}</h2>
          <p className="text-[14px] ink-body">{CLAIM_TEXT.emailBody(preview.emailMasked)}</p>
          {error ? <Banner tone="err">{error}</Banner> : null}
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await confirmClaimEmailAction(token);
                if (result.preview) setPreview(result.preview);
                else setError(result.error ?? null);
              });
            }}
          >
            {pending ? CLAIM_TEXT.confirming : CLAIM_TEXT.confirmEmail}
          </Button>
        </div>
      ) : null}

      {preview.state === 'AWAITING_CLAIM' || claimed ? (
        <form
          className="flex flex-col gap-4 rounded-[14px] border border-(--color-divider) bg-white p-5"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <h2 className="text-[13px] font-bold uppercase ink-muted">{CLAIM_TEXT.stepPhone}</h2>
          <p className="text-[14px] ink-body">{CLAIM_TEXT.phoneBody(preview.phoneMasked)}</p>
          <Field
            id="claim-phone"
            label={CLAIM_TEXT.phoneLabel}
            hint={CLAIM_TEXT.phoneHint(preview.phoneLast4)}
            error={error ?? undefined}
          >
            <Input
              id="claim-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder={CLAIM_TEXT.phonePlaceholder}
              value={phone}
              readOnly={claimed}
              onChange={(event) => setPhone(event.target.value)}
              {...invalidProps('claim-phone', error ?? undefined)}
            />
          </Field>
          <PhoneVerification
            widget={widget}
            phone={phone}
            fullName={CLAIM_TEXT.linkedTo}
            verified={claimed}
            verifiedTitle={CLAIM_TEXT.verifiedTitle}
            continueLabel={CLAIM_TEXT.continue}
            checkAvailability={null}
            verifyAction={(value, accessToken) => claimDealershipAction(token, value, accessToken)}
            onBeforeSend={() => {
              if (!IndianMobile.safeParse(phone).success) {
                setError(CLAIM_TEXT.phoneInvalid);
                return false;
              }
              if (!normaliseIndianMobile(phone)?.endsWith(preview.phoneLast4)) {
                setError(CLAIM_TEXT.phoneWrong(preview.phoneLast4));
                return false;
              }
              setError(null);
              return true;
            }}
            onVerified={(_value, result) => {
              setClaimed(true);
              router.replace(result.returnTo ?? '/dealer');
              router.refresh();
            }}
            onContinue={() => router.replace('/dealer')}
          />
        </form>
      ) : null}

      <p className="text-[12px] ink-muted">{CLAIM_TEXT.ignore}</p>
    </section>
  );
}
