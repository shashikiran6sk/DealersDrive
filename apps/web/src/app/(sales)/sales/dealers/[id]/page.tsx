import type { SalesDealerDetail } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StatusTag } from '@/components/ui/primitives';
import { DocumentUploader } from '@/features/auth/document-uploader';
import { YardPhotoUploader } from '@/features/auth/yard-photo-uploader';
import { AssistedDealerForm } from '@/features/sales/assisted-dealer-form';
import { EmailVerificationPanel } from '@/features/sales/email-verification-panel';
import { ASSISTED_FORM_TEXT } from '@/features/sales/assisted-dealer-form/assisted-dealer-form.constants';
import { updateAssistedDealerAction } from '@/features/sales/sales-actions';
import { SALES_TEXT } from '@/features/sales/sales.constants';
import { SubmitAssistedDealer } from '@/features/sales/submit-assisted-dealer';
import { salesDocumentBase, salesYardPhotoPaths } from '@/features/sales/upload-paths';
import { VerificationBadges } from '@/features/sales/verification-badges';
import { ApiError, apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dealership' };

export default async function AssistedDealerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let dealer: SalesDealerDetail;
  try {
    dealer = await apiGet<SalesDealerDetail>(`/v1/sales/dealers/${encodeURIComponent(id)}`, {
      revalidate: false,
    });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  const update = updateAssistedDealerAction.bind(null, dealer.id);
  const missing = dealer.completeness.steps
    .filter((step) => step.key !== 'review' && !step.complete)
    .map((step) => step.label);

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
        <div className="text-[13px] ink-muted">
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
      </div>

      {!dealer.canEdit ? (
        <p className="rounded-[12px] border border-(--color-divider) bg-white p-4 text-[13px] ink-body">
          {dealer.claimed ? SALES_TEXT.claimedNotice : SALES_TEXT.lockedNotice}
        </p>
      ) : null}

      <section className="flex flex-col gap-3 rounded-[14px] border border-(--color-divider) bg-white p-4 md:p-6">
        <h2 className="text-[17px]">{SALES_TEXT.emailHeading}</h2>
        <EmailVerificationPanel dealerId={dealer.id} verification={dealer.emailVerification} />
      </section>

      <section className="flex flex-col gap-3 rounded-[14px] border border-(--color-divider) bg-white p-4 md:p-6">
        <h2 className="text-[17px]">{SALES_TEXT.detailsHeading}</h2>
        <AssistedDealerForm
          initial={{
            contactName: dealer.contactName ?? '',
            email: dealer.email ?? '',
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
          submitLabel={ASSISTED_FORM_TEXT.save}
          partial
          disabled={!dealer.canEdit}
          onSubmit={update}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-[14px] border border-(--color-divider) bg-white p-4 md:p-6">
        <h2 className="text-[17px]">{SALES_TEXT.documentsHeading}</h2>
        {dealer.documents.map((document) => (
          <DocumentUploader
            key={document.type}
            document={document}
            basePath={salesDocumentBase(dealer.id)}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-[14px] border border-(--color-divider) bg-white p-4 md:p-6">
        <h2 className="text-[17px]">{SALES_TEXT.yardHeading}</h2>
        <YardPhotoUploader photo={dealer.yardPhoto} paths={salesYardPhotoPaths(dealer.id)} />
      </section>

      {dealer.canEdit ? (
        <section className="flex flex-col gap-3 rounded-[14px] border border-(--color-divider) bg-white p-4 md:p-6">
          <h2 className="text-[17px]">{SALES_TEXT.submitHeading}</h2>
          <SubmitAssistedDealer
            dealerId={dealer.id}
            canSubmit={dealer.canSubmit}
            missing={missing}
          />
        </section>
      ) : null}
    </div>
  );
}
