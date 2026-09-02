import type { AdminListingDetail } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Banner, ImageSlot, StatusTag, Tag } from '@/components/ui/primitives';
import { ReviewActions } from '@/features/admin/review-actions';
import { ModerationStrip } from '@/features/admin/moderation-strip';
import { ApiError, apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Review listing' };

/**
 * DESIGN-SPEC §3.17 — review listing.
 *
 * This is where a reviewer sees the vehicle exactly as the dealer submitted it,
 * before anything is public. The credit line is shown deliberately: the
 * consequence of each decision is money, and it should be on screen when the
 * decision is made.
 */
export default async function ReviewListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let listing: AdminListingDetail;
  try {
    listing = await apiGet<AdminListingDetail>(`/v1/admin/listings/${id}`, { revalidate: false });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="mx-auto max-w-[1000px] p-5">
      <Link href="/admin/listings" className="btn btn-ghost mb-[14px]">
        ← Back to queue
      </Link>

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(290px,1fr))]">
        <div className="min-w-0">
          <div className="relative aspect-[4/3] border border-(--color-divider) bg-(--color-surface)">
            {listing.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={listing.photos[0].url}
                alt={listing.photos[0].label}
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageSlot label="No photos submitted" />
            )}
            <span className="tag absolute bottom-[10px] right-[10px] z-[2] bg-white text-[11px]">
              {listing.photoCountLabel}
            </span>
          </div>

          {listing.photos.length > 1 ? <ModerationStrip photos={listing.photos} /> : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] leading-[1.15]">{listing.title}</h1>
              <StatusTag tone="warn">{listing.displayStatus}</StatusTag>
            </div>
            {/* `metaLabel` is already "₹3.45 Lakh · Arcot · Sri Lakshmi
                Motors" — the price, city and dealer composed once by the API. */}
            <p className="mt-1 text-[14px] ink-secondary tnum">{listing.metaLabel}</p>
            <Link href={listing.dealer.href} className="text-[13px]">
              Open dealer record →
            </Link>
          </div>

          {listing.flags.length > 0 ? (
            <Banner tone="warn" title="Flagged for attention">
              <ul>
                {listing.flags.map((flag) => (
                  <li key={flag.code}>• {flag.message}</li>
                ))}
              </ul>
            </Banner>
          ) : null}

          <dl className="border border-(--color-divider) bg-white">
            {listing.specs.map((spec) => (
              <div
                key={spec.key}
                className="flex justify-between gap-4 border-b border-(--color-divider) px-[14px] py-[10px] text-[13px] last:border-b-0"
              >
                <dt className="ink-muted">{spec.label}</dt>
                <dd className="font-medium tnum">{spec.value}</dd>
              </div>
            ))}
            {/* D8's `specs` already carries Photos submitted and Dealer status;
                the credit line is the one thing it does not, and it is the
                consequence of every button below. */}
            <div className="flex justify-between gap-4 px-[14px] py-[10px] text-[13px]">
              <dt className="ink-muted">Listing credit</dt>
              <dd className="font-medium tnum">
                {listing.credit.held ? '1 held for this listing' : 'not held'} ·{' '}
                {listing.credit.dealerBalance} in balance
              </dd>
            </div>
          </dl>

          {listing.description ? (
            <div>
              <h2 className="mb-1 text-[15px] font-semibold">Dealer description</h2>
              <p className="max-w-[66ch] text-[13px] leading-[1.6] ink-secondary">
                {listing.description}
              </p>
            </div>
          ) : (
            <Tag className="self-start text-[11px]">No description submitted</Tag>
          )}

          <ReviewActions listing={listing} />
        </div>
      </div>
    </div>
  );
}
