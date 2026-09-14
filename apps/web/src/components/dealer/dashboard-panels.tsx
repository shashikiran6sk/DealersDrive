import type { DashboardResponse } from '@dealers-drive/contracts';

import { Avatar } from '@/components/ui/primitives';

/**
 * DESIGN-SPEC §3.12 — the dashboard's two panels (**F048**).
 *
 * ── Deliberate difference from the baseline ─────────────────────────────────
 * The baseline declares both of these as private functions inside
 * `app/(dealer)/dealer/page.tsx`. They are their own file here for one reason,
 * and it is the reconstruction's own rule rather than a preference: **a
 * component that exists only inside a feature implementation, with no sandbox
 * entry, is not done** (CLAUDE.md §6). A component cannot have a sandbox entry
 * if it cannot be imported.
 *
 * That rule earns its keep here more than most. `ViewsChart` is a hand-rolled
 * bar chart — the exact shape of thing that gets rebuilt from scratch by the
 * next feature that wants one, the way `.table` was hand-rolled five separate
 * times in the baseline. F051's billing screen and F065's enquiries screen both
 * want a panel like `RecentEnquiries`; making them findable is the whole point
 * of the sandbox.
 *
 * Nothing about the markup changed. Both are server components, neither reads
 * anything, and both are still rendered only by `/dealer`.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * Seven bars and a total.
 *
 * **The heights are `heightPct` from the API, not a ratio computed here** —
 * that is the only way the chart cannot disagree with the numbers beside it
 * (rule 6, §4.11, and the contracts note on `DashboardResponse.viewsChart`).
 * The service scales them against the week's own maximum, with a floor of 1 so
 * a quiet week renders flat rather than `NaN%`.
 *
 * Each bar carries its own `aria-label`, because a chart is the one place where
 * the information is entirely in the geometry: seven unlabelled boxes tell a
 * screen reader nothing at all.
 */
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

/**
 * The newest four leads, each with a one-tap `tel:`.
 *
 * The empty state is not a placeholder — it is the state every new dealership
 * sees, and it says where leads will appear rather than leaving a blank panel.
 * Until `Enquiry` lands at **F088** it is also the only state the API can
 * produce.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline's heading row carries an `All enquiries →` ghost button onto
 * `/dealer/enquiries`, which arrives with **F065**. It is held back rather than
 * pointed at a 404 — the same rule `console-nav.tsx` applies to the sidebar
 * item for that route — and both return together.
 * ────────────────────────────────────────────────────────────────────────────
 */
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
