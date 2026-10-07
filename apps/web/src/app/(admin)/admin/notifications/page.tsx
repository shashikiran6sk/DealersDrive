import { AdminNotificationsResponse, NotificationStatus } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  NOTIFICATION_LOG_TEXT,
  NotificationLog,
  type NotificationLogFilters,
} from '@/features/admin/notification-log';
import { ApiError, apiGetParsed, qs } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: NOTIFICATION_LOG_TEXT.title };

type SearchParamsInput = Record<string, string | string[] | undefined>;

function one(params: SearchParamsInput, key: string): string | undefined {
  const value = params[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const status = NotificationStatus.safeParse(one(params, 'status'));
  const filters: NotificationLogFilters = {
    status: status.success ? status.data : undefined,
    q: one(params, 'q')?.slice(0, 120),
  };

  let deliveries: AdminNotificationsResponse;
  try {
    deliveries = await apiGetParsed(
      AdminNotificationsResponse,
      `/v1/admin/notifications${qs({ ...filters, cursor: one(params, 'cursor') })}`,
      { revalidate: false },
    );
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 400)) notFound();
    throw error;
  }

  return (
    <div className="p-5">
      <NotificationLog deliveries={deliveries} filters={filters} />
    </div>
  );
}
