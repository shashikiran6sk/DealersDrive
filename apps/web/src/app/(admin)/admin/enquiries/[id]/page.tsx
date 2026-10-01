import { AdminEnquiryDetail } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ENQUIRY_DETAIL_TEXT, EnquiryDetail } from '@/features/admin/enquiry-detail';
import { ApiError, apiGetParsed } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: ENQUIRY_DETAIL_TEXT.metaTitle };

export default async function AdminEnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let enquiry: AdminEnquiryDetail;
  try {
    enquiry = await apiGetParsed(
      AdminEnquiryDetail,
      `/v1/admin/enquiries/${encodeURIComponent(id)}`,
      { revalidate: false },
    );
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  return <EnquiryDetail enquiry={enquiry} />;
}
