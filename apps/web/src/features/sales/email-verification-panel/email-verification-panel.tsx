'use client';

import type { SalesEmailVerification } from '@dealers-drive/contracts';
import { useState, useTransition } from 'react';

import { Banner } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { resendVerificationAction } from '@/features/sales/sales-actions';

import { VERIFICATION_PANEL_TEXT } from './email-verification-panel.constants';

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function EmailVerificationPanel({
  dealerId,
  verification,
}: {
  dealerId: string;
  verification: SalesEmailVerification | null;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const expired =
    verification?.expiresAt !== null &&
    verification?.expiresAt !== undefined &&
    !verification.verifiedAt &&
    new Date(verification.expiresAt).getTime() < Date.now();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] ink-body">
        {!verification
          ? VERIFICATION_PANEL_TEXT.none
          : verification.claimedAt
            ? VERIFICATION_PANEL_TEXT.claimed(when(verification.claimedAt))
            : verification.verifiedAt
              ? VERIFICATION_PANEL_TEXT.verified(when(verification.verifiedAt))
              : verification.sentAt
                ? VERIFICATION_PANEL_TEXT.sent(verification.email, when(verification.sentAt))
                : VERIFICATION_PANEL_TEXT.queued(verification.email)}
      </p>
      {expired ? (
        <p className="text-[13px] text-(--color-warn)">{VERIFICATION_PANEL_TEXT.expired}</p>
      ) : null}
      <p className="text-[12px] ink-muted">{VERIFICATION_PANEL_TEXT.explain}</p>
      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
      {verification?.claimedAt ? null : (
        <div>
          <Button
            type="button"
            variant="secondary"
            disabled={pending || verification?.canResend === false}
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const result = await resendVerificationAction(dealerId);
                setMessage(
                  result.ok
                    ? { tone: 'ok', text: VERIFICATION_PANEL_TEXT.resent }
                    : { tone: 'err', text: result.message ?? '' },
                );
              });
            }}
          >
            {pending ? VERIFICATION_PANEL_TEXT.resending : VERIFICATION_PANEL_TEXT.resend}
          </Button>
        </div>
      )}
    </div>
  );
}
