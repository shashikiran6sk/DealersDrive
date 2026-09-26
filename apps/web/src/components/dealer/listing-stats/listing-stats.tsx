import type { DashboardResponse } from '@dealers-drive/contracts';
import Link from 'next/link';

import { StatCard } from '@/components/ui/primitives';

import { LISTING_STATS_LABEL } from './listing-stats.constants';

export function ListingStats({ stats }: { stats: DashboardResponse['listingStats'] }) {
  return (
    <nav
      aria-label={LISTING_STATS_LABEL}
      className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]"
    >
      {stats.map((stat) => (
        <Link
          key={stat.key}
          href={stat.href}
          className="no-underline hover:[&>*]:border-(--color-accent)"
        >
          <StatCard label={stat.label} value={String(stat.value)} />
        </Link>
      ))}
    </nav>
  );
}
