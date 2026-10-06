import type { Metadata } from 'next';
import Link from 'next/link';

import { ButtonLink } from '@/components/ui/button';
import { StatCard } from '@/components/ui/primitives';
import { SalesDealerList } from '@/features/sales/sales-dealer-list';
import { ADD_DEALERSHIP_HREF, SALES_TEXT } from '@/features/sales/sales.constants';
import { requireSalesMember } from '@/lib/sales-session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function SalesDashboardPage() {
  const dashboard = await requireSalesMember();

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px]">{SALES_TEXT.dashboardHeading(dashboard.member.name)}</h1>
          <p className="mt-1 max-w-[70ch] text-[13px] ink-muted">{SALES_TEXT.dashboardIntro}</p>
        </div>
        <ButtonLink href={ADD_DEALERSHIP_HREF} variant="primary">
          {SALES_TEXT.addDealership}
        </ButtonLink>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {dashboard.metrics.map((metric) =>
          metric.href ? (
            <Link key={metric.key} href={metric.href} className="no-underline">
              <StatCard label={metric.label} value={String(metric.value)} />
            </Link>
          ) : (
            <StatCard key={metric.key} label={metric.label} value={String(metric.value)} />
          ),
        )}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h2 className="flex-1 text-[17px]">{SALES_TEXT.recentHeading}</h2>
          <Link href="/sales/dealers" className="text-[13px]">
            {SALES_TEXT.viewAll}
          </Link>
        </div>
        <SalesDealerList dealers={dashboard.recent} emptyLabel={SALES_TEXT.empty} />
      </section>
    </div>
  );
}
