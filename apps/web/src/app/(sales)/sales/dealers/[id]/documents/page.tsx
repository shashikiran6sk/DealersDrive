import { SELECTABLE_DOC_CATEGORIES, type SalesDealerDetail } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StatusTag } from '@/components/ui/primitives';
import { DocumentUploader, documentForCategory } from '@/features/auth/document-uploader';
import { SALES_TEXT } from '@/features/sales/sales.constants';
import { SubmitAssistedDealer } from '@/features/sales/submit-assisted-dealer';
import { salesDocumentBase } from '@/features/sales/upload-paths';
import { ApiError, apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Documents and submission' };

export default async function AssistedDealerDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const missing = dealer.completeness.steps
    .filter((step) => step.key !== 'review' && !step.complete)
    .map((step) => step.label);

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6 p-4 md:p-8">
      <Link href={`/sales/dealers/${dealer.id}`} className="text-[13px]">
        {SALES_TEXT.backToDealer}
      </Link>

      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-bold uppercase ink-muted">{SALES_TEXT.documentsStep}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 text-[24px] break-words">{dealer.legalName}</h1>
          <StatusTag tone={dealer.statusTone}>{dealer.statusLabel}</StatusTag>
        </div>
        <p className="max-w-[70ch] text-[13px] ink-body">{SALES_TEXT.documentsOptional}</p>
      </div>

      <section className="flex flex-col gap-3 rounded-[14px] border border-(--color-divider) bg-white p-4 md:p-6">
        <h2 className="text-[17px]">{SALES_TEXT.documentsHeading}</h2>
        <p className="text-[13px] ink-muted">{SALES_TEXT.documentsIntro}</p>
        {SELECTABLE_DOC_CATEGORIES.map((category) => (
          <DocumentUploader
            key={category}
            category={category}
            document={documentForCategory(dealer.documents, category)}
            basePath={salesDocumentBase(dealer.id)}
            gstin={dealer.gstin}
          />
        ))}
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
