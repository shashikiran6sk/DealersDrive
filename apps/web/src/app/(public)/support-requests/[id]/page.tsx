import { CustomerSupportTicket } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import {
  SUPPORT_DETAIL_TEXT,
  SupportRequestDetail,
  supportLoginHref,
  supportRequestHref,
} from '@/features/support/support-requests';
import { ApiError, apiGetParsed } from '@/lib/api';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: SUPPORT_DETAIL_TEXT.metaTitle,
  ...seoMetadata({ kind: 'private' }),
};

export default async function SupportRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let ticket: CustomerSupportTicket;
  try {
    ticket = await apiGetParsed(
      CustomerSupportTicket,
      `/v1/support/tickets/${encodeURIComponent(id)}`,
      { revalidate: false },
    );
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) redirect(supportLoginHref(supportRequestHref(id)));
      if (error.status === 404 || error.status === 400) notFound();
    }
    throw error;
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pt-[22px] pb-[60px] sm:px-6">
      <SupportRequestDetail ticket={ticket} />
    </div>
  );
}
