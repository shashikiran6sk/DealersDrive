import type { DashboardResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { RecentEnquiries, ViewsChart } from '@/components/dealer/dashboard-panels';
import { Banner, StatCard } from '@/components/ui/primitives';
import { apiGet } from '@/lib/api';

/**
 * DESIGN-SPEC §3.12 — the console landing page (**F048**).
 *
 * **Every number here is C18's — none is computed on screen.** That is rule 6
 * (§4.11) at its most literal: the greeting, the four deltas, the bar heights
 * and the relative times all arrive formatted, so this file has no arithmetic
 * in it and cannot disagree with the API about what a dealer's week looked
 * like.
 *
 * It is also the route the buyer header's primary button points at. Before this
 * feature `/dealer` was a 404 with a layout and no page under it, so "Dealer
 * login" in the public header led nowhere. The layout's guard sends a signed-out
 * visitor to sign-in and a half-onboarded one to the wizard; this is the page it
 * has been guarding all along.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The markup is the baseline's. What differs is what the API can answer with:
 * views, enquiries, the expiry alert and the two activity deltas read models
 * that do not exist yet, so the chart draws a flat week, the panel is empty and
 * `alerts` is `[]`. `activeListings`, `creditBalance` and `creditsHeld` are
 * real. Nothing on this page needs changing when those models land — which is
 * the point of the numbers being the API's.
 *
 * The two panels are their own file rather than private functions here, so both
 * can have a sandbox entry (CLAUDE.md §6). See `dashboard-panels.tsx`.
 * ────────────────────────────────────────────────────────────────────────────
 */
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
