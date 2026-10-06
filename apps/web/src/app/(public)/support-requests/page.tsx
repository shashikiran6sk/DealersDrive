import { CustomerSupportTicketsResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import {
  SUPPORT_REQUESTS_PATH,
  SUPPORT_REQUESTS_TEXT,
  SupportRequestList,
  supportLoginHref,
} from '@/features/support/support-requests';
import { ApiError, apiGetParsed, qs } from '@/lib/api';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: SUPPORT_REQUESTS_TEXT.title,
  ...seoMetadata({ kind: 'private' }),
};

type SearchParamsInput = Record<string, string | string[] | undefined>;

export default async function SupportRequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const cursor = typeof params.cursor === 'string' ? params.cursor : undefined;

  let tickets: CustomerSupportTicketsResponse;
  try {
    tickets = await apiGetParsed(
      CustomerSupportTicketsResponse,
      `/v1/support/tickets${qs({ cursor })}`,
      { revalidate: false },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(supportLoginHref(SUPPORT_REQUESTS_PATH));
    }
    throw error;
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pt-[22px] pb-[60px] sm:px-6">
      <SupportRequestList tickets={tickets} />
    </div>
  );
}
