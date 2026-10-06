import type { AdminMemberHistoryResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StatusTag } from '@/components/ui/primitives';
import { MemberHistory } from '@/features/admin/admin-members';
import {
  MEMBER_DETAIL_TEXT,
  STATUS_TONE,
} from '@/features/admin/admin-members/admin-members.constants';
import { ApiError, apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Member history' };

export default async function AdminMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let detail: AdminMemberHistoryResponse;
  try {
    detail = await apiGet<AdminMemberHistoryResponse>(
      `/v1/admin/members/${encodeURIComponent(id)}/history`,
      { revalidate: false },
    );
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  const { member, history } = detail;

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-5 p-5 max-sm:p-4">
      <Link href="/admin/members" className="text-[13px]">
        {MEMBER_DETAIL_TEXT.back}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[24px] break-all">{member.name ?? member.email}</h1>
        <StatusTag tone={STATUS_TONE[member.status]}>{member.statusLabel}</StatusTag>
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-[13px]">
        <dt className="ink-muted">{MEMBER_DETAIL_TEXT.email}</dt>
        <dd className="break-all">{member.email}</dd>
        <dt className="ink-muted">{MEMBER_DETAIL_TEXT.role}</dt>
        <dd>{member.roleLabel}</dd>
        <dt className="ink-muted">{MEMBER_DETAIL_TEXT.lastSignIn}</dt>
        <dd>{member.lastLoginLabel}</dd>
        {member.disabledReason ? (
          <>
            <dt className="ink-muted">{MEMBER_DETAIL_TEXT.disabledReason}</dt>
            <dd>{member.disabledReason}</dd>
          </>
        ) : null}
      </dl>
      <section className="flex flex-col gap-3">
        <h2 className="text-[17px]">{MEMBER_DETAIL_TEXT.historyHeading}</h2>
        <MemberHistory entries={history} emptyLabel={MEMBER_DETAIL_TEXT.noHistory} />
      </section>
    </div>
  );
}
