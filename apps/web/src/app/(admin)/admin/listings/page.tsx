import { AdminListingsResponse, ListingStatus } from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import { MODERATION_TEXT, ModerationQueue } from '@/features/admin/moderation-queue';
import { apiGetParsed, qs } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: MODERATION_TEXT.title };

type SearchParamsInput = Record<string, string | string[] | undefined>;

function one(params: SearchParamsInput, key: string): string | undefined {
  const value = params[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
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
