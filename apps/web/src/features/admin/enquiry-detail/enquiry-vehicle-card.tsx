import type { AdminEnquiryDetail } from '@dealers-drive/contracts';
import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { StatusTag } from '@/components/ui/primitives';

import { DetailRow } from './detail-row';
import { ENQUIRY_DETAIL_TEXT } from './enquiry-detail.constants';

export function EnquiryVehicleCard({ vehicle }: { vehicle: AdminEnquiryDetail['vehicle'] }) {
  return (
    <section aria-labelledby="vehicle-heading" className="card gap-[10px] bg-white p-4">
      <h2 id="vehicle-heading" className="text-[16px]">
        {ENQUIRY_DETAIL_TEXT.vehicle}
      </h2>
      <div className="flex gap-3">
        <div className="grid aspect-[4/3] w-[120px] flex-none place-items-center overflow-hidden rounded-[10px] bg-(--color-neutral-100)">
          {vehicle.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- a media-service derivative, already sized
            <img
              src={vehicle.image.url}
              alt={vehicle.image.alt}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="px-2 text-center text-[11px] ink-subtle">
              {ENQUIRY_DETAIL_TEXT.noPhoto}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold">{vehicle.title}</div>
          <div className="font-mono text-[12px] ink-subtle">{vehicle.registrationDisplay}</div>
        </div>
      </div>
      <dl>
        <DetailRow label={ENQUIRY_DETAIL_TEXT.listingStatus}>
          <StatusTag tone={vehicle.listingStatusTone}>{vehicle.listingStatusLabel}</StatusTag>
        </DetailRow>
        <DetailRow label={ENQUIRY_DETAIL_TEXT.listingId}>
          <span className="font-mono text-[11px] [overflow-wrap:anywhere]">
            {vehicle.listingId}
          </span>
        </DetailRow>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={vehicle.adminHref} className="relative btn btn-secondary text-[12px]">
          <LinkPendingLabel>{ENQUIRY_DETAIL_TEXT.openListing}</LinkPendingLabel>
        </Link>
        {vehicle.publicHref ? (
          <Link href={vehicle.publicHref} className="relative btn btn-ghost text-[12px]">
            <LinkPendingLabel>{ENQUIRY_DETAIL_TEXT.openPublic}</LinkPendingLabel>
          </Link>
        ) : (
          <span className="text-[12px] ink-subtle">{ENQUIRY_DETAIL_TEXT.notPublic}</span>
        )}
      </div>
    </section>
  );
}
