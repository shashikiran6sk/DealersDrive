import { DealerInventoryResponse, ListingStatus } from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import { INVENTORY_TEXT, InventoryView } from '@/features/dealer/inventory';
import { apiGetParsed, qs } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: INVENTORY_TEXT.title };

type SearchParamsInput = Record<string, string | string[] | undefined>;

function one(params: SearchParamsInput, key: string): string | undefined {
  const value = params[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const parsedStatus = ListingStatus.safeParse(one(params, 'status'));
  const status = parsedStatus.success ? parsedStatus.data : undefined;
  const q = one(params, 'q')?.slice(0, 60);
  const cursor = one(params, 'cursor');

  const inventory = await apiGetParsed(
    DealerInventoryResponse,
    `/v1/dealer/vehicles${qs({ status, q, cursor })}`,
    { revalidate: false },
  );

  return (
    <div className="p-[22px]">
      <InventoryView inventory={inventory} status={status} q={q} />
    </div>
  );
}
