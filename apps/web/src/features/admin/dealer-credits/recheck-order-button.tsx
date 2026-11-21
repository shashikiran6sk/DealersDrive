'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { recheckCreditOrderAction } from '@/features/admin/credit-actions';
import { cn } from '@/lib/cn';

import { DEALER_CREDITS_TEXT } from './dealer-credits.constants';

export interface RecheckOrderButtonProps {
  dealerId: string;
  orderId: string;
  label: string;
}

export function RecheckOrderButton({ dealerId, orderId, label }: RecheckOrderButtonProps) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);

  async function recheck(): Promise<void> {
    setBusy(true);
    setResult(await recheckCreditOrderAction(dealerId, orderId));
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="secondary"
        loading={busy}
        disabled={busy}
        aria-label={label}
        onClick={() => void recheck()}
      >
        {DEALER_CREDITS_TEXT.recheck}
      </Button>
      {result?.message ? (
        <span
          role="status"
          className={cn('text-[12px]', result.ok ? 'ink-muted' : 'text-(--color-err)')}
        >
          {result.message}
        </span>
      ) : null}
    </div>
  );
}
