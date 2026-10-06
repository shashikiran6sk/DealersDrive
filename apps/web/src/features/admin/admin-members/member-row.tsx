'use client';

import type { AdminMemberDto } from '@dealers-drive/contracts';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { StatusTag } from '@/components/ui/primitives';

import { MEMBERS_TEXT, ROLE_OPTIONS, STATUS_TONE } from './admin-members.constants';
import { DisableMemberDialog } from './disable-member-dialog';

export interface MemberRowProps {
  member: AdminMemberDto;
  pending: boolean;
  onRoleChange: (member: AdminMemberDto, role: string) => void;
  onDisable: (member: AdminMemberDto, reason: string) => void;
  onActivate: (member: AdminMemberDto) => void;
}

export function MemberRow({
  member,
  pending,
  onRoleChange,
  onDisable,
  onActivate,
}: MemberRowProps) {
  const editable = member.lockedReason === null;
  const roleId = `member-role-${member.id}`;

  return (
    <tr>
      <td>
        <div className="break-all">{member.email}</div>
        {member.name ? <div className="text-[11px] ink-faint">{member.name}</div> : null}
        {member.invitedByEmail ? (
          <div className="text-[11px] ink-faint">
            {MEMBERS_TEXT.invitedBy(member.invitedByEmail)}
          </div>
        ) : null}
      </td>
      <td>
        {editable && member.status !== 'DISABLED' ? (
          <>
            <label htmlFor={roleId} className="sr-only">
              {MEMBERS_TEXT.roleFor(member.email)}
            </label>
            <Select
              id={roleId}
              value={member.role}
              disabled={pending}
              onChange={(event) => onRoleChange(member, event.target.value)}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label.split(' — ')[0]}
                </option>
              ))}
            </Select>
          </>
        ) : (
          member.roleLabel
        )}
      </td>
      <td>
        <StatusTag tone={STATUS_TONE[member.status]}>{member.statusLabel}</StatusTag>
        {member.disabledReason ? (
          <div className="text-[11px] ink-faint">
            {MEMBERS_TEXT.disabledBecause(member.disabledReason)}
          </div>
        ) : null}
      </td>
      <td>{member.lastLoginLabel}</td>
      <td className="text-right">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href={`/admin/members/${member.id}`} className="text-[12px]">
            {MEMBERS_TEXT.history}
          </Link>
          {!editable ? (
            <span className="text-[11px] ink-faint">
              {member.isYou ? MEMBERS_TEXT.you : member.lockedReason}
            </span>
          ) : member.status === 'DISABLED' ? (
            <Button size="sm" variant="ghost" loading={pending} onClick={() => onActivate(member)}>
              {MEMBERS_TEXT.reactivate}
            </Button>
          ) : (
            <DisableMemberDialog
              member={member}
              pending={pending}
              onConfirm={(reason) => onDisable(member, reason)}
            />
          )}
        </div>
      </td>
    </tr>
  );
}
