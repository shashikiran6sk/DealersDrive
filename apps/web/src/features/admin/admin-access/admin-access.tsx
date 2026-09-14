'use client';

import type { AdminAccessEntry } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Banner } from '@/components/ui/primitives';
import { Table } from '@/components/ui/table';
import { grantAdminAccessAction, revokeAdminAccessAction } from '@/features/admin/access-actions';

import { AdminAccessRow } from './admin-access-row';
import {
  ADMIN_ACCESS_COLUMNS,
  ADMIN_ACCESS_TEXT,
  DEFAULT_ADMIN_ROLE,
  ROLE_OPTIONS,
} from './admin-access.constants';

export interface AdminAccessPanelProps {
  entries: AdminAccessEntry[];
  currentUserId: string;
}

export function AdminAccessPanel({ entries, currentUserId }: AdminAccessPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [adminRole, setAdminRole] = useState<string>(DEFAULT_ADMIN_ROLE);
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState<string | null>(null);

  function grant(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setGranted(null);
    startTransition(async () => {
      const result = await grantAdminAccessAction({ email, adminRole });
      if (!result.ok) {
        setError(result.message ?? ADMIN_ACCESS_TEXT.grantFailed);
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
        setError(result.message ?? ADMIN_ACCESS_TEXT.revokeFailed);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[17px]">{ADMIN_ACCESS_TEXT.heading}</h2>
        <p className="mt-1 max-w-[70ch] text-[13px] ink-muted">{ADMIN_ACCESS_TEXT.intro}</p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3 border border-(--color-divider) bg-white p-4"
        onSubmit={grant}
      >
        <Field
          id="admin-access-email"
          label={ADMIN_ACCESS_TEXT.emailLabel}
          hint={ADMIN_ACCESS_TEXT.emailHint}
          className="min-w-[260px] flex-[2]"
        >
          <Input
            id="admin-access-email"
            type="email"
            autoComplete="off"
            placeholder={ADMIN_ACCESS_TEXT.emailPlaceholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field id="admin-access-role" label={ADMIN_ACCESS_TEXT.roleLabel} className="min-w-[160px]">
          <Select
            id="admin-access-role"
            value={adminRole}
            onChange={(event) => setAdminRole(event.target.value)}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Button type="submit" loading={pending} disabled={email.trim().length === 0}>
          {ADMIN_ACCESS_TEXT.grant}
        </Button>
      </form>

      {error ? <Banner tone="err">{error}</Banner> : null}
      {granted ? <Banner tone="ok">{ADMIN_ACCESS_TEXT.granted(granted)}</Banner> : null}

      <Table columns={[...ADMIN_ACCESS_COLUMNS]} caption={ADMIN_ACCESS_TEXT.caption}>
        {entries.map((entry) => (
          <AdminAccessRow
            key={entry.email}
            entry={entry}
            currentUserId={currentUserId}
            pending={pending}
            onRevoke={revoke}
          />
        ))}
      </Table>
    </section>
  );
}
