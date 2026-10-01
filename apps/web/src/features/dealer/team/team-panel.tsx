'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Banner } from '@/components/ui/primitives';
import {
  changeMemberRoleAction,
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
  type TeamActionResult,
} from '@/features/dealer/team-actions';

import { InvitationCard } from './invitation-card';
import { InviteMemberDialog } from './invite-member-dialog';
import { MemberCard } from './member-card';
import { TEAM_TEXT } from './team.constants';
import type { TeamPanelProps } from './team.types';

export function TeamPanel({ team }: TeamPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function run(work: () => Promise<TeamActionResult>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  async function invite(phone: string, role: string): Promise<TeamActionResult> {
    setError(null);
    const result = await inviteMemberAction(phone, role);
    if (result.ok) {
      setNotice(TEAM_TEXT.invited(phone.trim()));
      router.refresh();
    }
    return result;
  }

  async function remove(memberId: string): Promise<TeamActionResult> {
    const result = await removeMemberAction(memberId);
    if (result.ok) router.refresh();
    return result;
  }

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="flex flex-wrap items-end justify-between gap-[12px]">
        <div className="min-w-0">
          <h1 className="text-[25px] tracking-[-0.035em] md:text-[30px]">{TEAM_TEXT.title}</h1>
          <p className="max-w-[60ch] text-[13px] ink-muted">{TEAM_TEXT.intro}</p>
        </div>
        <InviteMemberDialog onInvite={invite} />
      </div>

      {error ? <Banner tone="err">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}

      <section className="flex flex-col gap-[10px]">
        <h2 className="text-[16px]">
          {TEAM_TEXT.membersHeading}{' '}
          <span className="text-[13px] font-semibold ink-subtle tnum">
            {TEAM_TEXT.count(team.members.length)}
          </span>
        </h2>
        <ul
          aria-label={TEAM_TEXT.membersLabel}
          className="m-0 flex list-none flex-col gap-[10px] p-0"
        >
          {team.members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              pending={pending}
              onChangeRole={(memberId, role) => run(() => changeMemberRoleAction(memberId, role))}
              onRemove={remove}
            />
          ))}
        </ul>
      </section>

      <section className="card flex flex-col bg-white p-[16px]">
        <h2 className="text-[16px]">{TEAM_TEXT.invitationsHeading}</h2>
        <p className="text-[12px] ink-muted">{TEAM_TEXT.invitationsHint}</p>
        {team.invitations.length === 0 ? (
          <p className="pt-[12px] text-[13px] ink-subtle">{TEAM_TEXT.noInvitations}</p>
        ) : (
          <ul aria-label={TEAM_TEXT.invitationsLabel} className="m-0 list-none p-0">
            {team.invitations.map((invitation) => (
              <InvitationCard
                key={invitation.id}
                invitation={invitation}
                pending={pending}
                onWithdraw={(id) => run(() => revokeInvitationAction(id))}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
