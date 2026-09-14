'use client';

import type { AdminAccessEntry } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Banner, Tag } from '@/components/ui/primitives';
import { Table } from '@/components/ui/table';
import { grantAdminAccessAction, revokeAdminAccessAction } from '@/features/admin/access-actions';

export function AdminAccessPanel({
  entries,
  currentUserId,
}: {
  entries: AdminAccessEntry[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [adminRole, setAdminRole] = useState('MODERATOR');
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState<string | null>(null);

  function grant(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setGranted(null);
    startTransition(async () => {
      const result = await grantAdminAccessAction({ email, adminRole });
      if (!result.ok) {
        setError(result.message ?? 'We could not grant that access.');
        return;
      }
      setGranted(result.entry?.email ?? email);
      setEmail('');
      router.refresh();
    });
  }

  function revoke(entry: AdminAccessEntry) {
    if (entry.userId === null) return;
    setError(null);
    setGranted(null);
    const userId = entry.userId;
    startTransition(async () => {
      const result = await revokeAdminAccessAction(userId);
      if (!result.ok) {
        setError(result.message ?? 'We could not withdraw that access.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[17px]">Admin access</h2>
        <p className="mt-1 max-w-[70ch] text-[13px] ink-muted">
          Everyone who can open this console. A granted address takes effect on their next sign-in —
          they still sign in with Google, and the address here has to be the one Google knows them
          by. Every grant and withdrawal is written to the audit trail.
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3 border border-(--color-divider) bg-white p-4"
        onSubmit={grant}
      >
        <Field
          id="admin-access-email"
          label="Email address"
          hint="the Google account"
          className="min-w-[260px] flex-[2]"
        >
          <Input
            id="admin-access-email"
            type="email"
            autoComplete="off"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field id="admin-access-role" label="Role" className="min-w-[160px]">
          <Select
            id="admin-access-role"
            value={adminRole}
            onChange={(event) => setAdminRole(event.target.value)}
          >
            <option value="SUPPORT">Support — read only</option>
            <option value="MODERATOR">Moderator — review and decide</option>
            <option value="SUPER_ADMIN">Super admin — everything</option>
          </Select>
        </Field>

        <Button type="submit" loading={pending} disabled={email.trim().length === 0}>
          Grant access
        </Button>
      </form>

      {error ? <Banner tone="err">{error}</Banner> : null}
      {granted ? <Banner tone="ok">{granted} can now open the admin console.</Banner> : null}

      <Table
        columns={[
          { key: 'who', label: 'Operator' },
          { key: 'role', label: 'Role' },
          { key: 'source', label: 'Access' },
          { key: 'seen', label: 'Last signed in' },
          { key: 'action', label: '', align: 'right' },
        ]}
        caption="Everyone who can open the admin console"
      >
        {entries.map((entry) => (
          <tr key={entry.email}>
            <td>
              <div>{entry.email}</div>
              {entry.fullName ? (
                <div className="text-[11px] ink-faint">{entry.fullName}</div>
              ) : null}
            </td>
            <td>{ROLE_LABELS[entry.adminRole]}</td>
            <td>
              <Tag>{entry.sourceLabel}</Tag>
              {entry.grantedByEmail ? (
                <div className="text-[11px] ink-faint">by {entry.grantedByEmail}</div>
              ) : null}
            </td>
            <td>{entry.lastLoginLabel}</td>
            <td className="text-right">
              {entry.userId !== null && entry.userId === currentUserId ? (
                <span className="text-[11px] ink-faint">You</span>
              ) : entry.canRevoke ? (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={pending}
                  onClick={() => {
                    revoke(entry);
                  }}
                >
                  Withdraw
                </Button>
              ) : (
                <span className="text-[11px] ink-faint">{entry.revokeBlockedReason}</span>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </section>
  );
}

const ROLE_LABELS: Record<AdminAccessEntry['adminRole'], string> = {
  SUPPORT: 'Support',
  MODERATOR: 'Moderator',
  SUPER_ADMIN: 'Super admin',
};
