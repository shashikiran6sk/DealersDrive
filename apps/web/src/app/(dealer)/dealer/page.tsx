import type { DashboardResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { RecentEnquiries, ViewsChart } from '@/components/dealer/dashboard-panels';
import { Banner, StatCard } from '@/components/ui/primitives';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DealerDashboardPage() {
  const dashboard = await apiGet<DashboardResponse>('/v1/dealer/dashboard', { revalidate: false });

  return (
    <div className="flex flex-col gap-[18px] p-[22px]">
      <div>
        <h1 className="text-[26px]">{dashboard.greeting}</h1>
        <p className="mt-1 text-[13px] ink-muted">{dashboard.subline}</p>
      </div>

      {dashboard.alerts.map((alert) => (
        <Banner
          key={alert.type}
          tone="warn"
          action={
            <Link href={alert.href} className="btn btn-secondary text-[12px]">
              Open
            </Link>
          }
        >
          {alert.message}
        </Banner>
      ))}

      <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(178px,1fr))]">
        {dashboard.stats.map((stat) => (
          <StatCard
            key={stat.key}
            label={stat.label}
            value={stat.valueLabel}
            delta={stat.delta}
            deltaTone={stat.deltaTone}
          />
        ))}
      </div>

      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
        <ViewsChart chart={dashboard.viewsChart} />
        <RecentEnquiries enquiries={dashboard.recentEnquiries} />
      </div>
    </div>
  );
}
