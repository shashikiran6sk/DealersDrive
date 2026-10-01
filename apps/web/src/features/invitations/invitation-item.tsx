'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Banner, StatusTag } from '@/components/ui/primitives';
import { acceptInvitationAction, declineInvitationAction } from '@/features/invitations/actions';

import { INVITATIONS_TEXT } from './invitations.constants';
import type { InvitationItemProps } from './invitations.types';

export function InvitationItem({ invitation }: InvitationItemProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  const [accepting, startAccepting] = useTransition();
  const [declining, startDeclining] = useTransition();
  const busy = accepting || declining;

  return (
    <li className="card flex flex-col gap-[12px] bg-white p-[18px]">
      <div className="flex flex-wrap items-center gap-[10px]">
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-extrabold">{invitation.dealer.brandName}</div>
          {invitation.dealer.city ? (
            <div className="text-[13px] ink-muted">{invitation.dealer.city}</div>
          ) : null}
        </div>
        <StatusTag tone="accent">{INVITATIONS_TEXT.invitedAs(invitation.roleLabel)}</StatusTag>
      </div>
      <p className="m-0 text-[13px] ink-muted">
        {invitation.invitedByName
          ? `${INVITATIONS_TEXT.invitedBy(invitation.invitedByName)} · `
          : null}
        {INVITATIONS_TEXT.until(invitation.expiresLabel)}
      </p>
      {message ? <Banner tone="err">{message}</Banner> : null}
      <div className="flex flex-wrap gap-[8px] border-t border-(--color-divider) pt-[12px]">
        <Button
          variant="primary"
          loading={accepting}
          disabled={busy}
          className="max-sm:w-full"
          onClick={() => {
            setMessage(undefined);
            startAccepting(async () => {
              const result = await acceptInvitationAction(invitation.id);
              if (!result.ok) setMessage(result.message);
            });
          }}
        >
          {INVITATIONS_TEXT.accept}
        </Button>
        <Button
          variant="secondary"
          loading={declining}
          disabled={busy}
          className="max-sm:w-full"
          onClick={() => {
            setMessage(undefined);
            startDeclining(async () => {
              const result = await declineInvitationAction(invitation.id);
              if (result.ok) router.refresh();
              else setMessage(result.message);
            });
          }}
        >
          {INVITATIONS_TEXT.decline}
        </Button>
      </div>
    </li>
  );
}
