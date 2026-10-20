'use client';

import { CUSTOMER_ACCOUNT_TEXT } from '@dealers-drive/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { deactivateCustomerAction } from '@/features/account/account-actions';

export function AccountControls({
  canDeactivate,
  customerId,
}: {
  canDeactivate: boolean;
  customerId: string | null;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(!canDeactivate);
  const lock = useRef(false);
  const submit = async () => {
    if (lock.current || !confirmed || !customerId) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await deactivateCustomerAction(confirmed, customerId);
      if (result.done) {
        setDone(true);
        router.refresh();
      } else {
        setError(result.error ?? CUSTOMER_ACCOUNT_TEXT.failed);
        setConfirmed(false);
        if (result.reauth) setReauth(true);
      }
    } catch {
      setError(CUSTOMER_ACCOUNT_TEXT.uncertain);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="card flex flex-col gap-4 bg-white p-5">
      <h2 className="text-[20px] font-bold">{CUSTOMER_ACCOUNT_TEXT.deactivate}</h2>
      <p className="text-[14px] leading-[1.8]">{CUSTOMER_ACCOUNT_TEXT.deactivateBody}</p>
      {done ? (
        <p role="status">{CUSTOMER_ACCOUNT_TEXT.deactivated}</p>
      ) : reauth || !customerId ? (
        <>
          <p className="text-[14px] leading-[1.8]">{CUSTOMER_ACCOUNT_TEXT.freshOtpBody}</p>
          <Link className="underline" href="/login?returnTo=%2Faccount">
            {CUSTOMER_ACCOUNT_TEXT.freshOtp}
          </Link>
        </>
      ) : (
        <>
          <label className="flex min-h-[44px] items-start gap-3 text-[14px]">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 h-[18px] w-[18px] shrink-0 accent-black"
            />
            {CUSTOMER_ACCOUNT_TEXT.confirmDeactivate}
          </label>
          <Button type="button" loading={busy} disabled={!confirmed} onClick={() => void submit()}>
            {CUSTOMER_ACCOUNT_TEXT.deactivate}
          </Button>
        </>
      )}
      {error ? (
        <p role="alert" className="text-[13px] text-(--color-err)">
          {error}
        </p>
      ) : null}
      <p className="text-[14px]">{CUSTOMER_ACCOUNT_TEXT.records}</p>
      <Link className="underline" href="/account-deletion">
        {CUSTOMER_ACCOUNT_TEXT.delete}
      </Link>
      <Link className="underline" href="/privacy">
        {CUSTOMER_ACCOUNT_TEXT.privacy}
      </Link>
    </section>
  );
}
