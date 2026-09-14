import type { AdminOverview } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Operations overview' };

export default async function AdminDashboardPage() {
  const overview = await apiGet<AdminOverview>('/v1/admin/metrics/overview', {
    revalidate: false,
  });

  return (
    <div className="flex flex-col gap-5 p-5">
      <h1 className="text-[26px]">Operations overview</h1>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(158px,1fr))]">
        {overview.stats.map((stat) => {
          const box = (
            <>
              <div className="eyebrow">{stat.label}</div>
              <div className="font-heading text-[28px] font-bold leading-[1.15] tnum">
                {stat.valueLabel}
              </div>
            </>
          );

          return stat.href ? (
            <Link
              key={stat.key}
              href={stat.href}
              className="border border-(--color-divider) bg-white p-[14px] no-underline"
            >
              {box}
            </Link>
          ) : (
            <div key={stat.key} className="border border-(--color-divider) bg-white p-[14px]">
              {box}
            </div>
          );
        })}
      </div>

      <section className="border border-(--color-divider) bg-white p-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[19px]">Moderation queue</h2>
        </div>
        <p className="mt-2 text-[13px] ink-muted tnum">{overview.moderationQueue.message}</p>
      </section>
    </div>
  );
}
