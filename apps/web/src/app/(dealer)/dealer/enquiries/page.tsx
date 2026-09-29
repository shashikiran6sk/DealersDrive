import { DealerEnquiriesResponse, EnquiryStatus } from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import { DEFAULT_ENQUIRY_TAB, ENQUIRIES_TEXT, EnquiryInbox } from '@/features/dealer/enquiries';
import { apiGetParsed, qs } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: ENQUIRIES_TEXT.title };

type SearchParamsInput = Record<string, string | string[] | undefined>;

function one(params: SearchParamsInput, key: string): string | undefined {
  const value = params[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const parsedStatus = EnquiryStatus.safeParse(one(params, 'status'));
  const status = parsedStatus.success ? parsedStatus.data : DEFAULT_ENQUIRY_TAB;
  const cursor = one(params, 'cursor');

  const inbox = await apiGetParsed(
    DealerEnquiriesResponse,
    `/v1/dealer/enquiries${qs({ status, cursor })}`,
    { revalidate: false },
  );

  return (
    <div className="px-4 py-[22px] md:px-8 md:py-[30px]">
      <EnquiryInbox inbox={inbox} status={status} />
    </div>
  );
}
