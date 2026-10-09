import type { DashboardResponse } from '@dealers-drive/contracts';
import Link from 'next/link';

import { SkeletonLines, StatCard } from '@/components/ui/primitives';

import {
  DASHBOARD_METRIC_CARD,
  DASHBOARD_METRIC_COUNT,
  DASHBOARD_METRICS_GRID,
  DASHBOARD_METRICS_TEXT,
} from './dashboard-metrics.constants';

export interface DashboardMetricsProps {
  stats?: DashboardResponse['stats'];
  listingStats?: DashboardResponse['listingStats'];
  loading?: boolean;
}

function SummaryMetric({
  stat,
  label,
}: {
  stat: DashboardResponse['stats'][number] | undefined;
  label: string;
}) {
  return (
    <StatCard
      label={stat?.label ?? label}
      value={stat?.valueLabel ?? DASHBOARD_METRICS_TEXT.unavailable}
      delta={stat?.delta ?? ''}
      deltaTone={stat?.deltaTone ?? 'neutral'}
      className={DASHBOARD_METRIC_CARD}
    />
  );
}

export function DashboardMetrics({
  stats = [],
  listingStats = [],
  loading = false,
}: DashboardMetricsProps) {
  if (loading) {
    return (
      <section
        role="status"
        aria-label={DASHBOARD_METRICS_TEXT.loading}
        aria-busy="true"
        className={DASHBOARD_METRICS_GRID}
      >
        {Array.from({ length: DASHBOARD_METRIC_COUNT }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="min-h-[120px] rounded-[14px] border border-(--color-divider) bg-white p-3 sm:p-5"
          >
            <SkeletonLines />
          </div>
        ))}
      </section>
    );
  }
  const pending = listingStats.find((stat) => stat.key === 'PENDING_REVIEW');
  const pendingCard = (
    <StatCard
      label={pending?.label ?? DASHBOARD_METRICS_TEXT.pending}
      value={pending ? String(pending.value) : DASHBOARD_METRICS_TEXT.unavailable}
      className={DASHBOARD_METRIC_CARD}
    />
  );

  return (
    <section aria-label={DASHBOARD_METRICS_TEXT.label} className={DASHBOARD_METRICS_GRID}>
      <SummaryMetric
        stat={stats.find((stat) => stat.key === 'activeListings')}
        label={DASHBOARD_METRICS_TEXT.active}
      />
      {pending ? (
        <Link
          href={pending.href}
          className="min-w-0 rounded-[14px] no-underline hover:[&>*]:border-(--color-neutral-400)"
        >
          {pendingCard}
        </Link>
      ) : (
        pendingCard
      )}
      <SummaryMetric
        stat={stats.find((stat) => stat.key === 'newEnquiries')}
        label={DASHBOARD_METRICS_TEXT.enquiries}
      />
      <SummaryMetric
        stat={stats.find((stat) => stat.key === 'views')}
        label={DASHBOARD_METRICS_TEXT.views}
      />
    </section>
  );
}
