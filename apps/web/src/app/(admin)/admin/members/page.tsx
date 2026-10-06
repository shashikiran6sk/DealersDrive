import { AdminMemberStatus, type AdminMembersResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import { AdminMembers } from '@/features/admin/admin-members';
import { MEMBERS_TEXT } from '@/features/admin/admin-members/admin-members.constants';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Members' };

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: requested } = await searchParams;
  const parsed = AdminMemberStatus.safeParse(requested);
  const status = parsed.success ? parsed.data : null;

  const members = await apiGet<AdminMembersResponse>(
    status ? `/v1/admin/members?status=${status}` : '/v1/admin/members',
    { revalidate: false },
  );

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-5 p-5 max-sm:p-4">
      <div>
        <h1 className="text-[26px]">{MEMBERS_TEXT.heading}</h1>
        <p className="mt-1 max-w-[75ch] text-[13px] ink-muted">{MEMBERS_TEXT.intro}</p>
      </div>
      <AdminMembers members={members.data} counts={members.counts} status={status ?? 'ALL'} />
    </div>
  );
}
