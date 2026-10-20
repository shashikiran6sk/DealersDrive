'use client';

import { CUSTOMER_ACCOUNT_TEXT } from '@dealers-drive/contracts';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { requestCustomerDeletionAction } from '@/features/account/account-actions';

export function DeletionRequest({ customerId }: { customerId: string }) {
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const lock = useRef(false);
  const submit = async () => {
    if (lock.current || !confirmed) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const signature = message.trim();
      if (request.current?.signature !== signature)
        request.current = { signature, id: crypto.randomUUID() };
      const result = await requestCustomerDeletionAction({
        confirmed: true,
        message: signature,
        clientRequestId: request.current.id,
        expectedAccountId: customerId,
      });
      if (result.reference) {
        setReference(result.reference);
        request.current = null;
      } else setError(result.error ?? CUSTOMER_ACCOUNT_TEXT.failed);
    } catch {
      setError(CUSTOMER_ACCOUNT_TEXT.failed);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="card flex flex-col gap-4 bg-white p-5">
      <p className="text-[14px] leading-[1.8]">{CUSTOMER_ACCOUNT_TEXT.deletionBody}</p>
      {reference ? (
        <>
          <p role="status">{CUSTOMER_ACCOUNT_TEXT.deletionReceived(reference)}</p>
          <p>{CUSTOMER_ACCOUNT_TEXT.deletionPending}</p>
        </>
      ) : (
        <>
          <label className="field">
            <span>{CUSTOMER_ACCOUNT_TEXT.deletionMessage}</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={4000}
              disabled={busy}
              rows={4}
              className="input min-h-[100px] py-3"
            />
          </label>
          <label className="flex min-h-[44px] items-start gap-3 text-[14px]">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 h-[18px] w-[18px] shrink-0 accent-black"
            />
            {CUSTOMER_ACCOUNT_TEXT.deletionConfirm}
          </label>
          {error ? (
            <p role="alert" className="text-[13px] text-(--color-err)">
              {error}
            </p>
          ) : null}
          <Button type="button" loading={busy} disabled={!confirmed} onClick={() => void submit()}>
            {CUSTOMER_ACCOUNT_TEXT.delete}
          </Button>
        </>
      )}
      <Link className="underline" href="/support-requests">
        {CUSTOMER_ACCOUNT_TEXT.requests}
      </Link>
      <Link className="underline" href="/privacy">
        {CUSTOMER_ACCOUNT_TEXT.privacy}
      </Link>
    </section>
  );
}
