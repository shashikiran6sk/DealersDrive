import {
  AdminListingsResponse,
  AdminReactivationsResponse,
  ListingStatus,
  ReactivationRequestStatus,
} from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import {
  MODERATION_TEXT,
  ModerationQueue,
  REACTIVATION_VIEW,
  ReactivationQueue,
} from '@/features/admin/moderation-queue';
import { apiGetParsed, qs } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: MODERATION_TEXT.title };

type SearchParamsInput = Record<string, string | string[] | undefined>;

function one(params: SearchParamsInput, key: string): string | undefined {
  const value = params[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

async function reactivationView(params: SearchParamsInput) {
  const parsedStatus = ReactivationRequestStatus.safeParse(one(params, 'status'));
  const status = parsedStatus.success ? parsedStatus.data : undefined;
  const cursor = one(params, 'cursor');

  const [requests, listings] = await Promise.all([
    apiGetParsed(
      AdminReactivationsResponse,
      `/v1/admin/reactivation-requests${qs({ status, cursor })}`,
      { revalidate: false },
    ),
    apiGetParsed(AdminListingsResponse, `/v1/admin/listings${qs({ limit: 1 })}`, {
      revalidate: false,
    }),
  ]);

  return (
    <div className="p-5">
      <ReactivationQueue requests={requests} listingCounts={listings.counts} />
    </div>
  );
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  if (one(params, 'view') === REACTIVATION_VIEW) return reactivationView(params);

  const parsedStatus = ListingStatus.safeParse(one(params, 'status'));
  const status = parsedStatus.success ? parsedStatus.data : undefined;
  const q = one(params, 'q')?.slice(0, 60);
  const cursor = one(params, 'cursor');

  const listings = await apiGetParsed(
    AdminListingsResponse,
    `/v1/admin/listings${qs({ status, q, cursor })}`,
    { revalidate: false },
  );

  return (
    <div className="p-5">
      <ModerationQueue listings={listings} q={q} />
    </div>
  );
}
