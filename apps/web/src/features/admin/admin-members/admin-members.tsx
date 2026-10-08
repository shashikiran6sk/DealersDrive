'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Banner } from '@/components/ui/primitives';
import { Table } from '@/components/ui/table';
import {
  activateMemberAction,
  changeMemberRoleAction,
  disableMemberAction,
  inviteMemberAction,
  type MemberActionResult,
} from '@/features/admin/member-actions';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

import { MEMBER_COLUMNS, MEMBERS_TEXT, ROLE_OPTIONS, STATUS_TABS } from './admin-members.constants';
import type { AdminMembersProps } from './admin-members.types';
import { MemberRow } from './member-row';

export function AdminMembers({ members, counts, status }: AdminMembersProps) {
  const router = useRouter();
  const [pending, startTransition] = useNavigationSafeAction();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function run(
    work: () => Promise<MemberActionResult>,
    success: (r: MemberActionResult) => string,
  ) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setError(result.message ?? null);
        return;
      }
      setNotice(success(result));
      router.refresh();
    });
  }

  function invite(event: FormEvent) {
    event.preventDefault();
    run(
      () => inviteMemberAction({ email, name, role }),
      (result) => {
        setEmail('');
        setName('');
        setRole('');
        return MEMBERS_TEXT.invited(result.member?.email ?? email);
      },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        className="flex flex-wrap items-end gap-3 rounded-[14px] border border-(--color-divider) bg-white p-4"
        onSubmit={invite}
        aria-labelledby="invite-member-heading"
      >
        <h2 id="invite-member-heading" className="w-full text-[15px]">
          {MEMBERS_TEXT.inviteHeading}
        </h2>
        <Field
          id="member-email"
          label={MEMBERS_TEXT.emailLabel}
          hint={MEMBERS_TEXT.emailHint}
          className="min-w-[240px] max-md:min-w-0 max-md:max-w-full flex-[2]"
        >
          <Input
            id="member-email"
            type="email"
            autoComplete="off"
            required
            placeholder={MEMBERS_TEXT.emailPlaceholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field
          id="member-name"
          label={MEMBERS_TEXT.nameLabel}
          hint={MEMBERS_TEXT.nameHint}
          className="min-w-[180px] max-md:min-w-0 max-md:max-w-full flex-1"
        >
          <Input
            id="member-name"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field
          id="member-role"
          label={MEMBERS_TEXT.roleLabel}
          className="min-w-[220px] max-md:min-w-0 max-md:max-w-full flex-1"
        >
          <Select
            id="member-role"
            required
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="" disabled>
              {MEMBERS_TEXT.roleLabel}
            </option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" loading={pending} disabled={email.trim().length === 0 || role === ''}>
          {MEMBERS_TEXT.invite}
        </Button>
      </form>

      {error ? <Banner tone="err">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}

      <nav aria-label={MEMBERS_TEXT.tabsLabel} className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === 'ALL' ? '/admin/members' : `/admin/members?status=${tab.key}`}
            aria-current={status === tab.key ? 'page' : undefined}
            aria-selected={status === tab.key}
            className="dd-chip no-underline"
          >
            {tab.label} <span className="tnum opacity-70">{counts[tab.key]}</span>
          </Link>
        ))}
      </nav>

      <Table columns={[...MEMBER_COLUMNS]} caption={MEMBERS_TEXT.caption}>
        {members.length === 0 ? (
          <tr>
            <td colSpan={MEMBER_COLUMNS.length} className="text-center ink-muted">
              {MEMBERS_TEXT.empty}
            </td>
          </tr>
        ) : (
          members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              pending={pending}
              onRoleChange={(target, next) =>
                run(
                  () => changeMemberRoleAction(target.id, next),
                  () => MEMBERS_TEXT.saved,
                )
              }
              onDisable={(target, reason) =>
                run(
                  () => disableMemberAction(target.id, reason),
                  () => MEMBERS_TEXT.saved,
                )
              }
              onActivate={(target) =>
                run(
                  () => activateMemberAction(target.id),
                  () => MEMBERS_TEXT.saved,
                )
              }
            />
          ))
        )}
      </Table>
    </div>
  );
}
