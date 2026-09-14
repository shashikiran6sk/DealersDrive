import type { AdminOverview } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { apiGet } from '@/lib/api';

/**
 * DESIGN-SPEC §3.17 — six plain stat boxes (no blueprint marks in admin), then
 * the moderation-queue panel.
 *
 * The shell has been mounted since **F049** and, until now, had no page under
 * it: `/admin` was a 404 that the sidebar's first nav item pointed at, and the
 * console could only be entered by typing `/admin/dealers`. This is the screen
 * the shell was built for.
 *
 * It re-reads `GET /v1/admin/metrics/overview`, which the layout above it has
 * already read for the header badge. Two calls rather than a prop, deliberately:
 * `AdminLayout` cannot pass data to its children — a layout and a page are
 * separate server components — and the alternative is a context provider around
 * a value that is already `revalidate: false` and served from one process.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * Five of the six counters read `Listing` (F064), `Payment` (F052) and
 * `Enquiry` (F088), none of which exists, so each reports zero — the true
 * answer with no rows. The gross/net GST split behind two of them is real and
 * is the part that is expensive to get wrong later. See `admin.service.ts`.
 * ────────────────────────────────────────────────────────────────────────────
 */
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

          /*
           * A box is a link only when the API gave it an `href`. That is the
           * API's decision rather than this page's, and it is what keeps the
           * grid honest during the reconstruction: `pendingVerification` points
           * at `/admin/dealers`, which exists, and the five counters whose
           * screens have not landed carry no `href` at all.
           */
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
          {/*
            ── Reconstruction slice ───────────────────────────────────────────
            The baseline's `Open queue →` ghost button sits here, onto
            `overview.moderationQueue.href` — `/admin/listings`, which arrives
            with **F069**. Held back rather than pointed at a 404, the same way
            the nav item for that route is; both return with F069.

            The panel stays, because its sentence is true and is the one an
            operator needs: with no listings table there is nothing waiting for
            review, and the message says exactly that.
            ───────────────────────────────────────────────────────────────────
          */}
        </div>
        <p className="mt-2 text-[13px] ink-muted tnum">{overview.moderationQueue.message}</p>
      </section>
    </div>
  );
}
