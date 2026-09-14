import type { AdminDealerDetail } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { LogoTile, StatusTag } from '@/components/ui/primitives';
import { DealerAdminActions } from '@/features/admin/dealer-actions';
import { DealerProfileEditor } from '@/features/admin/dealer-profile-editor';
import { DocumentReview } from '@/features/admin/document-review';
import { ProfileChangeReview } from '@/features/admin/profile-change-review';
import { ApiError, apiGet } from '@/lib/api';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dealer' };

export default async function AdminDealerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let dealer: AdminDealerDetail;
  try {
    dealer = await apiGet<AdminDealerDetail>(`/v1/admin/dealers/${id}`, { revalidate: false });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4 p-5">
      <Link href="/admin/dealers" className="btn btn-ghost self-start">
        ← Back to dealers
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <LogoTile initials={dealer.initials} size={48} />
        <div className="min-w-0">
          <h1 className="text-[24px] leading-[1.15]">{dealer.brandName}</h1>
          <p className="text-[13px] ink-muted">
            {dealer.legalName} · joined <span className="tnum">{dealer.joinedLabel}</span>
          </p>
        </div>
        <StatusTag tone={dealer.statusTone} className="ml-auto">
          {dealer.statusLabel}
        </StatusTag>
      </div>

      {dealer.statusReason ? (
        <p className="border border-(--color-divider) bg-white p-3 text-[13px] ink-secondary">
          {dealer.statusReason}
        </p>
      ) : null}

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(158px,1fr))]">
        {[
          ['Vehicles', dealer.counts.vehicles],
          ['Live listings', dealer.counts.active],
          ['Pending review', dealer.counts.pending],
          ['Enquiries', dealer.counts.enquiries],
          ['Credit balance', dealer.creditBalance],
          ['Credits held', dealer.creditsHeld],
        ].map(([label, value]) => (
          <div key={String(label)} className="border border-(--color-divider) bg-white p-[14px]">
            <div className="eyebrow">{label}</div>
            <div className="font-heading text-[28px] font-bold leading-[1.15] tnum">{value}</div>
          </div>
        ))}
      </div>

      {dealer.profileChange ? <ProfileChangeReview change={dealer.profileChange} /> : null}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(290px,1fr))]">
        <DealerProfileEditor dealer={dealer} />

        <section className="card gap-2 p-4">
          <h2 className="text-[19px]">Yard photo</h2>
          {dealer.mapsUrl ? (
            <a
              href={dealer.mapsUrl}
              target="_blank"
              rel="noreferrer nofollow"
              className="text-[13px] text-(--color-accent)"
            >
              Open the yard in Google Maps
            </a>
          ) : (
            <p className="text-[13px] ink-muted">No Google Maps location on file.</p>
          )}
          {dealer.yardPhotoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={dealer.yardPhotoUrl}
              alt={`The yard at ${dealer.brandName}`}
              className="h-[220px] w-full border border-(--color-divider) object-cover"
            />
          ) : (
            <p className="py-3 text-[13px] ink-muted">
              Not uploaded. A dealership cannot be submitted for verification without one.
            </p>
          )}
        </section>
      </div>

      <section className="card gap-0 p-4">
        <h2 className="mb-2 text-[19px]">
          Documents{' '}
          <span className="text-[12px] font-normal ink-muted">
            {dealer.allDocumentsVerified ? 'all verified' : 'verification pending'}
          </span>
        </h2>
        <DocumentReview documents={dealer.documents} dealerSlug={dealer.slug} />
      </section>

      <DealerAdminActions dealer={dealer} />

      <section className="card gap-0 p-4">
        <h2 className="mb-2 text-[19px]">Recent credit movements</h2>
        {dealer.recentLedger.length === 0 ? (
          <p className="py-3 text-[13px] ink-muted">No movements yet.</p>
        ) : (
          dealer.recentLedger.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 border-b border-(--color-divider) py-[9px] text-[13px] last:border-b-0"
            >
              <span
                className={cn(
                  'w-[38px] flex-none font-mono tnum',
                  row.delta > 0
                    ? 'text-(--color-ok)'
                    : row.delta < 0
                      ? 'text-(--color-err)'
                      : 'ink-subtle',
                )}
              >
                {row.deltaLabel}
              </span>
              <span className="min-w-0 flex-1">{row.label}</span>
              <span className="whitespace-nowrap text-[11px] ink-faint tnum">{row.dateLabel}</span>
              <span className="whitespace-nowrap text-[12px] ink-muted tnum">
                bal {row.balanceAfter}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
