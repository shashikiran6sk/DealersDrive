import { DealerStatus, type SalesDealersResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { SalesDealerList } from '@/features/sales/sales-dealer-list';
import { SALES_TEXT, STATUS_TABS } from '@/features/sales/sales.constants';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'My Dealerships' };

export default async function SalesDealersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const parsed = DealerStatus.safeParse((await searchParams).status);
  const status = parsed.success ? parsed.data : null;
  const dealers = await apiGet<SalesDealersResponse>(
    status ? `/v1/sales/dealers?status=${status}` : '/v1/sales/dealers',
    { revalidate: false },
  );

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5 p-4 md:p-8">
      <div>
        <h1 className="text-[26px]">{SALES_TEXT.dealersHeading}</h1>
        <p className="mt-1 max-w-[70ch] text-[13px] ink-muted">{SALES_TEXT.dealersIntro}</p>
      </div>
      <nav aria-label={SALES_TEXT.tabsLabel} className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex gap-[8px]">
          {STATUS_TABS.map((tab) => {
            const selected = (status ?? 'ALL') === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.key === 'ALL' ? '/sales/dealers' : `/sales/dealers?status=${tab.key}`}
                aria-current={selected ? 'page' : undefined}
                aria-selected={selected}
                className="dd-chip no-underline"
              >
                {tab.label} <span className="tnum opacity-70">{dealers.counts[tab.key] ?? 0}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <SalesDealerList
        dealers={dealers.data}
        emptyLabel={status ? SALES_TEXT.emptyFilter : SALES_TEXT.empty}
      />
    </div>
  );
}
