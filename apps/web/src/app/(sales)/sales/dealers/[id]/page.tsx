import {
  normaliseIndianMobile,
  type PhoneOtpWidget,
  type SalesDealerDetail,
  type SalesVehiclesResponse,
} from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StatusTag } from '@/components/ui/primitives';
import { AssistedDealerForm } from '@/features/sales/assisted-dealer-form';
import { SALES_VEHICLE_TEXT, SalesVehicleList } from '@/features/sales/sales-vehicle-list';
import { ASSISTED_FORM_TEXT } from '@/features/sales/assisted-dealer-form/assisted-dealer-form.constants';
import { updateAssistedDealerAction } from '@/features/sales/sales-actions';
import { RepScopeNotice } from '@/features/sales/rep-scope-notice';
import { SALES_TEXT } from '@/features/sales/sales.constants';
import { VerificationBadges } from '@/features/sales/verification-badges';
import { VerifyOwnerPanel } from '@/features/sales/verify-owner-panel';
import { ApiError, apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dealership' };

export default async function AssistedDealerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let dealer: SalesDealerDetail;
  let listings: SalesVehiclesResponse;
  try {
    [dealer, listings] = await Promise.all([
      apiGet<SalesDealerDetail>(`/v1/sales/dealers/${encodeURIComponent(id)}`, {
        revalidate: false,
      }),
      apiGet<SalesVehiclesResponse>(`/v1/sales/dealers/${encodeURIComponent(id)}/vehicles`, {
        revalidate: false,
      }),
    ]);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  const update = updateAssistedDealerAction.bind(null, dealer.id);
  const documentsHref = `/sales/dealers/${dealer.id}/documents`;
  const businessComplete = dealer.completeness.steps.some(
    (step) => step.key === 'business' && step.complete,
  );
  const ownerPhone = dealer.canVerify ? normaliseIndianMobile(dealer.phoneDisplay) : null;
  const widget = ownerPhone
    ? await apiGet<PhoneOtpWidget>('/v1/sales/phone/widget', { revalidate: false })
    : null;

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6 p-4 md:p-8">
      <Link href="/sales/dealers" className="text-[13px]">
        {SALES_TEXT.backToList}
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 text-[24px] break-words">{dealer.legalName}</h1>
          <StatusTag tone={dealer.statusTone}>{dealer.statusLabel}</StatusTag>
        </div>
        <div className="text-[13px] break-words ink-muted">
          {[dealer.contactName, dealer.phoneDisplay, dealer.email].filter(Boolean).join(' · ')}
        </div>
        <VerificationBadges dealer={dealer} />
        {dealer.consentAt ? (
          <p className="text-[12px] ink-muted">
            {SALES_TEXT.consentRecorded(new Date(dealer.consentAt).toLocaleString('en-IN'))}
          </p>
        ) : null}
        {dealer.statusReason ? (
          <p className="text-[13px] text-(--color-warn)">
            {SALES_TEXT.statusReason(dealer.statusReason)}
          </p>
        ) : null}
        <Link href={documentsHref} className="text-[13px] font-semibold">
          {SALES_TEXT.documentsLink}
        </Link>
      </div>

      {dealer.canEdit ? <RepScopeNotice businessComplete={businessComplete} /> : null}

      {!dealer.canEdit ? (
        <p className="rounded-[12px] border border-(--color-divider) bg-white p-4 text-[13px] ink-body">
          {dealer.claimed ? SALES_TEXT.ownerNotice : SALES_TEXT.lockedNotice}
        </p>
      ) : null}

      {ownerPhone ? (
        <section className="flex flex-col gap-3 rounded-[14px] border border-(--color-divider) bg-white p-4 md:p-6">
          <h2 className="text-[17px]">{SALES_TEXT.verifyHeading}</h2>
          <VerifyOwnerPanel
            dealerId={dealer.id}
            phone={ownerPhone}
            phoneDisplay={dealer.phoneDisplay}
            widget={widget}
          />
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-[14px] border border-(--color-divider) bg-white p-4 md:p-6">
        <h2 className="text-[17px]">{SALES_VEHICLE_TEXT.heading}</h2>
        <SalesVehicleList dealerId={dealer.id} listings={listings} />
      </section>

      <section className="flex flex-col gap-3 rounded-[14px] border border-(--color-divider) bg-white p-4 md:p-6">
        <h2 className="text-[17px]">
          {dealer.canEdit ? SALES_TEXT.stepDetails : SALES_TEXT.detailsHeading}
        </h2>
        <AssistedDealerForm
          initial={{
            contactName: dealer.contactName ?? '',
            landline: dealer.landline ?? '',
            legalName: dealer.legalName,
            addressLine: dealer.address.line ?? '',
            city: dealer.address.city ?? '',
            district: dealer.address.district ?? '',
            state: dealer.address.state ?? '',
            pincode: dealer.address.pincode ?? '',
            mapsUrl: dealer.address.mapsUrl ?? '',
            tagline: dealer.tagline ?? '',
            gstin: dealer.gstin ?? '',
            pan: dealer.pan ?? '',
          }}
          initialServices={dealer.specialities}
          submitLabel={ASSISTED_FORM_TEXT.saveAndContinue}
          partial
          disabled={!dealer.canEdit}
          onSubmit={update}
          doneHref={documentsHref}
        />
      </section>
    </div>
  );
}
