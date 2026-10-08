'use client';

import { LEGAL_VERSION } from '@dealers-drive/contracts';
import { LegalCheck } from '@/features/legal/legal-check';
import { useLegalEnabled } from '@/features/legal/legal-provider';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { StatusTag } from '@/components/ui/primitives';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

import { ENQUIRY_MESSAGE_MAX, ENQUIRY_PANEL_TEXT } from './enquiry-panel.constants';
import type { EnquiryFormProps } from './enquiry-panel.types';

export function EnquiryForm({ customer, dealerName, onSend, onCancel }: EnquiryFormProps) {
  const id = useId();
  const legal = useLegalEnabled();
  const [permitted, setPermitted] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useNavigationSafeAction();
  const inFlight = useRef(false);

  return (
    <form
      className="flex flex-col gap-[14px] rounded-[16px] border border-(--color-divider) bg-white p-[18px]"
      aria-labelledby={`${id}-heading`}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (legal && !permitted) {
          setError('Choose whether to share your details before sending.');
          return;
        }
        if (inFlight.current) return;
        inFlight.current = true;
        setError(null);
        startTransition(async () => {
          const result = legal
            ? await onSend(message, { version: LEGAL_VERSION, granted: true })
            : await onSend(message);
          inFlight.current = false;
          if (result.status === 'invalid') setError(result.message);
          if (result.status === 'refused') setError(result.message);
        });
      }}
    >
      <h2 id={`${id}-heading`} className="text-[17px]">
        {ENQUIRY_PANEL_TEXT.heading}
      </h2>

      <dl className="m-0 grid gap-[10px] text-[14px]">
        <div>
          <dt className="text-[12px] ink-secondary">{ENQUIRY_PANEL_TEXT.nameLabel}</dt>
          <dd className="m-0 font-medium">{customer.fullName}</dd>
        </div>
        <div>
          <dt className="text-[12px] ink-secondary">{ENQUIRY_PANEL_TEXT.mobileLabel}</dt>
          <dd className="m-0 flex items-center gap-[8px]">
            <span className="font-mono tnum">{customer.phoneDisplay}</span>
            <StatusTag tone="ok">{ENQUIRY_PANEL_TEXT.verified}</StatusTag>
          </dd>
        </div>
      </dl>

      <div className="field">
        <label htmlFor={`${id}-message`}>
          {ENQUIRY_PANEL_TEXT.messageLabel}
          <span className="ml-1 ink-faint">{ENQUIRY_PANEL_TEXT.messageHint}</span>
        </label>
        <textarea
          id={`${id}-message`}
          name="message"
          className="input min-h-[88px] py-[8px]"
          maxLength={ENQUIRY_MESSAGE_MAX}
          placeholder={ENQUIRY_PANEL_TEXT.messagePlaceholder}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
          }}
        />
      </div>

      <p className="m-0 text-[12px] ink-secondary">{ENQUIRY_PANEL_TEXT.shareNote(dealerName)}</p>

      <LegalCheck kind="enquiry" dealerName={dealerName} onCompleteChange={setPermitted} />
      {legal ? (
        <p className="text-[12px]">
          <a href="/agreements" className="underline">
            Review your account agreements
          </a>{' '}
          ·{' '}
          <a href="/data-rights" className="underline">
            Withdraw future sharing
          </a>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="m-0 text-[12px] text-(--color-err)">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-[8px]">
        <Button
          type="submit"
          variant="primary"
          size="md"
          className="min-h-[44px] flex-1"
          loading={pending}
        >
          {ENQUIRY_PANEL_TEXT.send}
        </Button>
        <Button variant="secondary" size="md" className="min-h-[44px]" onClick={onCancel}>
          {ENQUIRY_PANEL_TEXT.cancel}
        </Button>
      </div>
    </form>
  );
}
