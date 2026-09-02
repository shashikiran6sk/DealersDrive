import type { DashboardResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Avatar, Banner, StatCard } from '@/components/ui/primitives';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dashboard' };

/** DESIGN-SPEC §3.12. Every number here is C18's — none is computed on screen. */
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

/**
 * The bar heights are `heightPct` from the API, not a ratio computed here —
 * that is the only way the chart cannot disagree with the numbers beside it
 * (contracts note on `DashboardResponse.viewsChart`).
 */
function ViewsChart({ chart }: { chart: DashboardResponse['viewsChart'] }) {
  return (
    <section className="card gap-3 p-[14px]">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[19px]">{chart.title}</h2>
        <span className="ml-auto text-[12px] ink-muted tnum">{chart.totalLabel}</span>
      </div>

      <div className="flex h-[132px] items-end gap-[9px] max-[375px]:h-[110px]">
        {chart.series.map((point) => (
          <div key={point.date} className="flex h-full flex-1 flex-col justify-end">
            <div
              className="bg-(--color-accent)"
              style={{ height: `${point.heightPct}%` }}
              role="img"
              aria-label={`${point.day}: ${point.views} views`}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-[9px]">
        {chart.series.map((point) => (
          <div key={point.date} className="flex-1 text-center text-[10px] ink-subtle">
            {point.day}
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentEnquiries({ enquiries }: { enquiries: DashboardResponse['recentEnquiries'] }) {
  return (
    <section className="card gap-0 p-[14px]">
      <div className="mb-2 flex items-baseline gap-3">
        <h2 className="text-[19px]">Recent enquiries</h2>
        <Link href="/dealer/enquiries" className="btn btn-ghost ml-auto text-[12px]">
          All enquiries →
        </Link>
      </div>

      {enquiries.length === 0 ? (
        <p className="py-6 text-center text-[13px] ink-muted">
          No enquiries yet. They land here the moment a buyer taps Enquire or Call.
        </p>
      ) : (
        enquiries.slice(0, 4).map((enquiry) => (
          <div
            key={enquiry.id}
            className="flex items-center gap-3 border-b border-(--color-divider) py-[10px] last:border-b-0"
          >
            <Avatar initials={enquiry.initials} size={30} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">{enquiry.name}</div>
              <div className="truncate text-[11px] ink-subtle">
                {enquiry.vehicleTitle ?? 'General enquiry'}
              </div>
            </div>
            <span className="whitespace-nowrap text-[11px] ink-faint">{enquiry.timeAgoLabel}</span>
            <a
              href={enquiry.callHref}
              className="btn btn-secondary text-[11px]"
              aria-label={`Call ${enquiry.name} on ${enquiry.phoneDisplay}`}
            >
              Call
            </a>
          </div>
        ))
      )}
    </section>
  );
}
