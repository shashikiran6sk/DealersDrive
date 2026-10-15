'use client';

import { CUSTOMER_ACCOUNT_TEXT } from '@dealers-drive/contracts';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { customerReactivateAction } from '@/features/auth/sign-in-actions';

export function CustomerReactivation({
  flowId,
  phoneDisplay,
  fullName,
  onDone,
  onRestart,
}: {
  flowId: string;
  phoneDisplay: string;
  fullName?: string;
  onDone: () => void;
  onRestart: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const confirm = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await customerReactivateAction(flowId);
      if (result.done) onDone();
      else setError(result.error ?? CUSTOMER_ACCOUNT_TEXT.failed);
    } catch {
      setError(CUSTOMER_ACCOUNT_TEXT.failed);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="card flex flex-col gap-4 bg-white p-5">
      <p>{CUSTOMER_ACCOUNT_TEXT.deactivatedAccount}</p>
      {fullName ? <p className="font-semibold">{fullName}</p> : null}
      <p>{phoneDisplay}</p>
      <p className="text-[14px] leading-[1.8]">{CUSTOMER_ACCOUNT_TEXT.reactivationBody}</p>
      {error ? (
        <p role="alert" className="text-[13px] text-(--color-err)">
          {error}
        </p>
      ) : null}
      <Button type="button" loading={busy} onClick={() => void confirm()}>
        {CUSTOMER_ACCOUNT_TEXT.reactivate}
      </Button>
      <Button type="button" variant="secondary" disabled={busy} onClick={onRestart}>
        {CUSTOMER_ACCOUNT_TEXT.restart}
      </Button>
    </div>
  );
}
