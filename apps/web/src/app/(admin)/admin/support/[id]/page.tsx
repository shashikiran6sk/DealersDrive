import { AdminSupportTicketDetail, type AdminOverview } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SUPPORT_TICKET_TEXT, SupportTicketWorkspace } from '@/features/admin/support-ticket';
import { ApiError, apiGet, apiGetParsed } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: SUPPORT_TICKET_TEXT.metaTitle };

export default async function AdminSupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let ticket: AdminSupportTicketDetail;
  let overview: AdminOverview;
  try {
    [ticket, overview] = await Promise.all([
      apiGetParsed(
        AdminSupportTicketDetail,
        `/v1/admin/support/tickets/${encodeURIComponent(id)}`,
        {
          revalidate: false,
        },
      ),
      apiGet<AdminOverview>('/v1/admin/metrics/overview', { revalidate: false }),
    ]);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  const viewer = ticket.assignees.find(
    (person) => person.email.toLowerCase() === overview.operator.email.toLowerCase(),
  );

  return <SupportTicketWorkspace ticket={ticket} viewerId={viewer?.id ?? null} />;
}
