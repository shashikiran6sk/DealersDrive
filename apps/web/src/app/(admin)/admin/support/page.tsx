import {
  AdminSupportTicketsResponse,
  IstDay,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  Uuid,
} from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import {
  SUPPORT_QUEUE_TEXT,
  SupportQueue,
  type SupportQueueFilterValues,
} from '@/features/admin/support-queue';
import { apiGetParsed, qs } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: SUPPORT_QUEUE_TEXT.title };

type SearchParamsInput = Record<string, string | string[] | undefined>;

function one(params: SearchParamsInput, key: string): string | undefined {
  const value = params[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function parsed<T>(
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  value: string | undefined,
): T | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

function assigneeOf(value: string | undefined): string | undefined {
  if (value === 'me' || value === 'unassigned') return value;
  return Uuid.safeParse(value).success ? value : undefined;
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const filters: SupportQueueFilterValues = {
    status: parsed(SupportTicketStatus, one(params, 'status')),
    category: parsed(SupportTicketCategory, one(params, 'category')),
    priority: parsed(SupportTicketPriority, one(params, 'priority')),
    assignee: assigneeOf(one(params, 'assignee')),
    q: one(params, 'q')?.slice(0, 120),
    from: parsed(IstDay, one(params, 'from')),
    to: parsed(IstDay, one(params, 'to')),
  };
  const cursor = one(params, 'cursor');

  const tickets = await apiGetParsed(
    AdminSupportTicketsResponse,
    `/v1/admin/support/tickets${qs({ ...filters, cursor })}`,
    { revalidate: false },
  );

  return (
    <div className="p-5">
      <SupportQueue tickets={tickets} filters={filters} />
    </div>
  );
}
