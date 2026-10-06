import { Button } from '@/components/ui/button';
import { StatusTag } from '@/components/ui/primitives';

import { TEAM_TEXT } from './team.constants';
import type { InvitationCardProps } from './team.types';

export function InvitationCard({ invitation, pending, onWithdraw }: InvitationCardProps) {
  return (
    <li className="flex flex-wrap items-center gap-[10px] border-b border-(--color-divider) py-[12px] last:border-b-0">
      <div className="min-w-0 flex-1 basis-[180px]">
        <div className="font-mono text-[14px] font-semibold whitespace-nowrap tnum">
          {invitation.phoneDisplay}
        </div>
        <div className="text-[12px] ink-subtle">{TEAM_TEXT.expires(invitation.expiresLabel)}</div>
      </div>
      <StatusTag tone="neutral">{invitation.roleLabel}</StatusTag>
      <StatusTag tone={invitation.status === 'EXPIRED' ? 'warn' : 'accent'}>
        {invitation.statusLabel}
      </StatusTag>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-label={TEAM_TEXT.withdrawLabel(invitation.phoneDisplay)}
        onClick={() => onWithdraw(invitation.id)}
      >
        {TEAM_TEXT.withdraw}
      </Button>
    </li>
  );
}
