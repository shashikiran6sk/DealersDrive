import { EnquiryCreatedResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { Blueprint, ImageSlot } from '@/components/ui/primitives';
import { ENQUIRY_RESULT_COOKIE } from '@/features/enquiry/shared';
import { seoMetadata } from '@/lib/seo';

/** Never cached and never indexed — it exists for exactly one buyer, once. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Enquiry sent',
  ...seoMetadata({ kind: 'private' }),
};

/** The cookie is ours, but it still crossed a boundary — parse it, don't trust it. */
function readResult(raw: string): EnquiryCreatedResponse | null {
  try {
    const parsed = EnquiryCreatedResponse.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export default async function EnquirySentPage() {
  const raw = (await cookies()).get(ENQUIRY_RESULT_COOKIE)?.value;

  // Arriving here without having just sent an enquiry — a bookmark, or a
  // refresh once the ten-minute cookie has expired — is not an error state, it
  // is a wrong turn.
  const result = raw ? readResult(raw) : null;
  if (!result) redirect('/cars');

  return (
    <div className="mx-auto max-w-[640px] px-6 py-20">
      <Blueprint className="bg-white p-[34px]">
        <div
          className="grid h-11 w-11 place-items-center bg-(--color-ok-bg) text-[20px] text-(--color-ok)"
          aria-hidden="true"
        >
          ✓
        </div>

        <h1 className="mt-[18px] text-[34px] leading-[1.08]">
          Enquiry sent to {result.dealer.brandName}
        </h1>

        <p className="mt-[10px] text-[15px] leading-[1.6] ink-secondary">
          {result.isDuplicate
            ? `You have already enquired about this car. ${result.dealer.brandName} has your number and ${result.dealer.responseTimeLabel}.`
            : `The dealer has your number and ${result.dealer.responseTimeLabel}.`}{' '}
          Your enquiry reference is <strong className="font-mono">{result.reference}</strong>.
        </p>

        {result.vehicle ? (
          <div className="mt-[22px] flex items-center gap-[14px] border border-(--color-divider) p-[14px]">
            <div className="h-[56px] w-[74px] flex-none border border-(--color-divider) bg-(--color-surface)">
              {result.vehicle.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={result.vehicle.thumbnailUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageSlot label={result.vehicle.title} />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-heading text-[15px] font-semibold">{result.vehicle.title}</div>
              <div className="text-[13px] ink-muted tnum">
                {result.vehicle.priceLabel} · {result.vehicle.city}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-[22px] flex flex-wrap gap-2">
          <Link href="/cars" className="btn btn-primary">
            Keep browsing
          </Link>
          {result.vehicle ? (
            <Link href={`/car/${result.vehicle.slug}`} className="btn btn-secondary">
              Back to the car
            </Link>
          ) : (
            <Link href={`/dealers/${result.dealer.slug}`} className="btn btn-secondary">
              Back to the dealership
            </Link>
          )}
        </div>
      </Blueprint>
    </div>
  );
}
