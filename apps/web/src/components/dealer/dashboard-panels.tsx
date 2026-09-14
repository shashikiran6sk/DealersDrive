import type { DashboardResponse } from '@dealers-drive/contracts';

import { Avatar } from '@/components/ui/primitives';

export function ViewsChart({ chart }: { chart: DashboardResponse['viewsChart'] }) {
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
              style={{ height: `${String(point.heightPct)}%` }}
              role="img"
              aria-label={`${point.day}: ${String(point.views)} views`}
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

export function RecentEnquiries({
  enquiries,
}: {
  enquiries: DashboardResponse['recentEnquiries'];
}) {
  return (
    <section className="card gap-0 p-[14px]">
      <div className="mb-2 flex items-baseline gap-3">
        <h2 className="text-[19px]">Recent enquiries</h2>
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
