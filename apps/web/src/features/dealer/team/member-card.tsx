'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/input';
import { Avatar, Banner, StatusTag } from '@/components/ui/primitives';

import { ROLE_OPTIONS, TEAM_TEXT } from './team.constants';
import type { MemberCardProps } from './team.types';

export function MemberCard({ member, pending, onChangeRole, onRemove }: MemberCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string>();
  const [removing, startRemoving] = useTransition();
  const roleId = `member-role-${member.id}`;

  return (
    <li className="card bg-white p-[16px]">
      <div className="flex flex-wrap items-center gap-[12px]">
        <Avatar initials={member.initials} size={38} />
        <div className="min-w-0 flex-1 basis-[200px]">
          <div className="flex flex-wrap items-center gap-[8px]">
            <span className="truncate text-[15px] font-extrabold">{member.name}</span>
            {member.isYou ? <StatusTag tone="neutral">{TEAM_TEXT.you}</StatusTag> : null}
          </div>
          <div className="flex flex-wrap gap-x-[10px] text-[12px] ink-muted">
            {member.phoneDisplay ? (
              <span className="font-mono whitespace-nowrap tnum">{member.phoneDisplay}</span>
            ) : null}
            {member.email ? <span className="truncate">{member.email}</span> : null}
            <span className="ink-subtle">{TEAM_TEXT.joined(member.joinedLabel)}</span>
          </div>
        </div>

        {member.manageable ? (
          <div className="flex w-full items-center gap-[8px] sm:w-auto">
            <label htmlFor={roleId} className="sr-only">
              {TEAM_TEXT.roleSelectLabel(member.name)}
            </label>
            <Select
              id={roleId}
              value={member.role}
              disabled={pending}
              className="min-h-[40px] flex-1 sm:w-[140px] sm:flex-none"
              onChange={(event) => onChangeRole(member.id, event.target.value)}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Dialog
              open={confirming}
              onOpenChange={(next) => {
                setConfirming(next);
                if (!next) setMessage(undefined);
              }}
              title={TEAM_TEXT.removeTitle(member.name)}
              description={TEAM_TEXT.removeDescription}
              trigger={
                <Button variant="secondary" size="sm" disabled={pending}>
                  {TEAM_TEXT.remove}
                </Button>
              }
              footer={
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setConfirming(false)}
                    disabled={removing}
                  >
                    {TEAM_TEXT.cancel}
                  </Button>
                  <Button
                    variant="danger"
                    loading={removing}
                    onClick={() => {
                      startRemoving(async () => {
                        const result = await onRemove(member.id);
                        if (result.ok) setConfirming(false);
                        else setMessage(result.message);
                      });
                    }}
                  >
                    {TEAM_TEXT.removeConfirm}
                  </Button>
                </>
              }
            >
              {message ? <Banner tone="err">{message}</Banner> : null}
            </Dialog>
          </div>
        ) : (
          <StatusTag tone="ok">{member.roleLabel}</StatusTag>
        )}
      </div>
    </li>
  );
}
