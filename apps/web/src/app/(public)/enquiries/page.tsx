import { CustomerEnquiriesResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import {
  CUSTOMER_ENQUIRIES_TEXT,
  CustomerEnquiryList,
  loginToSee,
} from '@/features/enquiry/customer-enquiries';
import { ApiError, apiGetParsed, qs } from '@/lib/api';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: CUSTOMER_ENQUIRIES_TEXT.title,
  ...seoMetadata({ kind: 'private' }),
};

type SearchParamsInput = Record<string, string | string[] | undefined>;

export default async function MyEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const cursor = typeof params.cursor === 'string' ? params.cursor : undefined;

  let enquiries: CustomerEnquiriesResponse;
  try {
    enquiries = await apiGetParsed(CustomerEnquiriesResponse, `/v1/enquiries${qs({ cursor })}`, {
      revalidate: false,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(loginToSee());
    throw error;
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pt-[22px] pb-[60px] sm:px-6">
      <CustomerEnquiryList enquiries={enquiries} />
    </div>
  );
}
