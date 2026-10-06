import { AdminEnquiriesResponse, EnquiryStatus, IstDay } from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import {
  ENQUIRY_OVERSIGHT_TEXT,
  EnquiryOversight,
  type EnquiryOversightFilterValues,
} from '@/features/admin/enquiry-oversight';
import { apiGetParsed, qs } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: ENQUIRY_OVERSIGHT_TEXT.title };

type SearchParamsInput = Record<string, string | string[] | undefined>;

function one(params: SearchParamsInput, key: string): string | undefined {
  const value = params[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function day(params: SearchParamsInput, key: string): string | undefined {
  const parsed = IstDay.safeParse(one(params, key));
  return parsed.success ? parsed.data : undefined;
}

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const parsedStatus = EnquiryStatus.safeParse(one(params, 'status'));
  const filters: EnquiryOversightFilterValues = {
    status: parsedStatus.success ? parsedStatus.data : undefined,
    q: one(params, 'q')?.slice(0, 120),
    dealer: one(params, 'dealer')?.slice(0, 160),
    from: day(params, 'from'),
    to: day(params, 'to'),
  };
  const cursor = one(params, 'cursor');

  const enquiries = await apiGetParsed(
    AdminEnquiriesResponse,
    `/v1/admin/enquiries${qs({ ...filters, cursor })}`,
    { revalidate: false },
  );

  return (
    <div className="p-5">
      <EnquiryOversight enquiries={enquiries} filters={filters} />
    </div>
  );
}
