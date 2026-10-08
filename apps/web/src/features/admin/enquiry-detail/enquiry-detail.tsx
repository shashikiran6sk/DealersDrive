import type { AdminEnquiryDetail } from '@dealers-drive/contracts';
import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { StatusTag } from '@/components/ui/primitives';

import { DetailRow } from './detail-row';
import { ENQUIRY_DETAIL_TEXT } from './enquiry-detail.constants';
import { EnquiryHistory } from './enquiry-history';
import { EnquiryTickets } from './enquiry-tickets';
import { EnquiryVehicleCard } from './enquiry-vehicle-card';

export function EnquiryDetail({ enquiry }: { enquiry: AdminEnquiryDetail }) {
  const { customer, dealer } = enquiry;

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-5 p-5">
      <Link href="/admin/enquiries" className="relative btn btn-ghost self-start">
        <LinkPendingLabel>{ENQUIRY_DETAIL_TEXT.back}</LinkPendingLabel>
      </Link>

      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] leading-[1.15]">{ENQUIRY_DETAIL_TEXT.title(customer.name)}</h1>
          <p className="mt-1 text-[14px] ink-muted tnum">
            {enquiry.vehicle.title} · {dealer.name} ·{' '}
            <time dateTime={enquiry.createdAt}>
              {ENQUIRY_DETAIL_TEXT.received(enquiry.createdLabel)}
            </time>
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <StatusTag tone={enquiry.statusTone}>{enquiry.statusLabel}</StatusTag>
        </div>
      </header>

      <p className="rounded-[12px] border border-(--color-divider) bg-white px-[14px] py-[11px] text-[13px] ink-muted">
        {ENQUIRY_DETAIL_TEXT.readOnly}
      </p>

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(290px,1fr))]">
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-labelledby="enquiry-heading" className="card gap-[8px] bg-white p-4">
            <h2 id="enquiry-heading" className="text-[16px]">
              {ENQUIRY_DETAIL_TEXT.enquiry}
            </h2>
            <div>
              <div className="text-[12px] ink-muted">{ENQUIRY_DETAIL_TEXT.message}</div>
              <p className="mt-[4px] max-w-[66ch] text-[14px] whitespace-pre-line ink-body [overflow-wrap:anywhere]">
                {enquiry.message ?? (
                  <span className="ink-subtle">{ENQUIRY_DETAIL_TEXT.noMessage}</span>
                )}
              </p>
            </div>
            <dl>
              {enquiry.sourceLabel ? (
                <DetailRow label="Source">
                  {enquiry.sourceLabel}
                  {enquiry.storefrontHostname ? ` · ${enquiry.storefrontHostname}` : ''}
                </DetailRow>
              ) : null}
              <DetailRow label={ENQUIRY_DETAIL_TEXT.status}>
                <StatusTag tone={enquiry.statusTone}>{enquiry.statusLabel}</StatusTag>
              </DetailRow>
              <DetailRow label={ENQUIRY_DETAIL_TEXT.customerSees}>
                {enquiry.customerStatusLabel}
              </DetailRow>
              <DetailRow label={ENQUIRY_DETAIL_TEXT.sent}>{enquiry.createdLabel}</DetailRow>
              {enquiry.contactedLabel ? (
                <DetailRow label={ENQUIRY_DETAIL_TEXT.contacted}>
                  {enquiry.contactedLabel}
                </DetailRow>
              ) : null}
              {enquiry.closedLabel ? (
                <DetailRow label={ENQUIRY_DETAIL_TEXT.closed}>{enquiry.closedLabel}</DetailRow>
              ) : null}
            </dl>
            <p className="text-[11px] ink-subtle">{ENQUIRY_DETAIL_TEXT.timesInIst}</p>
          </section>

          <section aria-labelledby="customer-heading" className="card gap-[8px] bg-white p-4">
            <h2 id="customer-heading" className="text-[16px]">
              {ENQUIRY_DETAIL_TEXT.customer}
            </h2>
            <dl>
              <DetailRow label={ENQUIRY_DETAIL_TEXT.name}>{customer.name}</DetailRow>
              <DetailRow label={ENQUIRY_DETAIL_TEXT.mobile}>
                {customer.phoneDisplay ? (
                  <span className="inline-flex flex-wrap items-center justify-end gap-[6px]">
                    <span className="font-mono">{customer.phoneDisplay}</span>
                    {customer.phoneVerified ? (
                      <StatusTag tone="ok">{ENQUIRY_DETAIL_TEXT.verified}</StatusTag>
                    ) : null}
                  </span>
                ) : (
                  <span className="ink-faint">{ENQUIRY_DETAIL_TEXT.noNumber}</span>
                )}
              </DetailRow>
              <DetailRow label={ENQUIRY_DETAIL_TEXT.memberSince}>
                {customer.memberSinceLabel}
              </DetailRow>
            </dl>
          </section>

          <section aria-labelledby="dealer-heading" className="card gap-[8px] bg-white p-4">
            <h2 id="dealer-heading" className="text-[16px]">
              {ENQUIRY_DETAIL_TEXT.dealer}
            </h2>
            <dl>
              <DetailRow label={ENQUIRY_DETAIL_TEXT.name}>{dealer.name}</DetailRow>
              <DetailRow label={ENQUIRY_DETAIL_TEXT.dealerStatus}>
                <StatusTag tone={dealer.statusTone}>{dealer.statusLabel}</StatusTag>
              </DetailRow>
              <DetailRow label={ENQUIRY_DETAIL_TEXT.location}>
                {dealer.location ?? (
                  <span className="ink-faint">{ENQUIRY_DETAIL_TEXT.notEntered}</span>
                )}
              </DetailRow>
              <DetailRow label={ENQUIRY_DETAIL_TEXT.dealerPhone}>
                {dealer.phoneDisplay ? (
                  <span className="font-mono">{dealer.phoneDisplay}</span>
                ) : (
                  <span className="ink-faint">{ENQUIRY_DETAIL_TEXT.notEntered}</span>
                )}
              </DetailRow>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Link href={dealer.adminHref} className="relative btn btn-secondary text-[12px]">
                <LinkPendingLabel>{ENQUIRY_DETAIL_TEXT.openDealer}</LinkPendingLabel>
              </Link>
              <Link
                href={`/admin/enquiries?dealer=${encodeURIComponent(dealer.slug)}`}
                className="relative btn btn-ghost text-[12px]"
              >
                <LinkPendingLabel>{ENQUIRY_DETAIL_TEXT.dealerEnquiries}</LinkPendingLabel>
              </Link>
            </div>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <EnquiryVehicleCard vehicle={enquiry.vehicle} />
          <EnquiryTickets tickets={enquiry.supportTickets} />
          <EnquiryHistory history={enquiry.history} />
        </div>
      </div>
    </div>
  );
}
