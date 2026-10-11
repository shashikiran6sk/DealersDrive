'use client';

import type { CustomerSupportTicket } from '@dealers-drive/contracts';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { reopenSupportRequestAction } from '../support-actions';
import { SUPPORT_DETAIL_TEXT } from './support-requests.constants';

export interface SupportReopenPanelProps {
  ticketId: string;
  onReopened: (ticket: CustomerSupportTicket) => void;
}

export function SupportReopenPanel({ ticketId, onReopened }: SupportReopenPanelProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reopen(): Promise<void> {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await reopenSupportRequestAction(ticketId);
    setPending(false);
    if (result.status === 'reopened') onReopened(result.ticket);
    else if (result.status === 'signed-out') setError(SUPPORT_DETAIL_TEXT.signedOut);
    else setError(result.message);
  }

  return (
    <section
      aria-labelledby="support-resolved-heading"
      className="card flex flex-col items-start gap-[10px] bg-white p-[16px]"
    >
      <h2 id="support-resolved-heading" className="text-[16px]">
        {SUPPORT_DETAIL_TEXT.resolvedTitle}
      </h2>
      <p className="text-[14px] ink-muted">{SUPPORT_DETAIL_TEXT.resolvedMessage}</p>
      {error ? (
        <p role="alert" className="text-[13px] text-red-700">
          {error}
        </p>
      ) : null}
      <Button type="button" variant="primary" disabled={pending} onClick={() => void reopen()}>
        {pending ? SUPPORT_DETAIL_TEXT.reopening : SUPPORT_DETAIL_TEXT.reopen}
      </Button>
    </section>
  );
}
