import { CustomerEnquiriesResponse, SupportTicketCategory, Uuid } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  NEW_SUPPORT_REQUEST_PATH,
  SUPPORT_FORM_TEXT,
  SUPPORT_REQUESTS_PATH,
  SupportRequestForm,
  supportLoginHref,
} from '@/features/support/support-requests';
import { ApiError, apiGetParsed, qs } from '@/lib/api';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: SUPPORT_FORM_TEXT.title,
  ...seoMetadata({ kind: 'private' }),
};

type SearchParamsInput = Record<string, string | string[] | undefined>;

export default async function NewSupportRequestPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const category = SupportTicketCategory.safeParse(params.category);
  const enquiry = Uuid.safeParse(params.enquiry);
  const initialCategory = category.success ? category.data : undefined;
  const initialEnquiryId = enquiry.success ? enquiry.data : undefined;

  let enquiries: CustomerEnquiriesResponse;
  try {
    enquiries = await apiGetParsed(CustomerEnquiriesResponse, '/v1/enquiries?limit=50', {
      revalidate: false,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(
        supportLoginHref(
          `${NEW_SUPPORT_REQUEST_PATH}${qs({ category: initialCategory, enquiry: initialEnquiryId })}`,
        ),
      );
    }
    throw error;
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-[16px] px-4 pt-[22px] pb-[60px] sm:px-6">
      <Link href={SUPPORT_REQUESTS_PATH} className="btn btn-ghost self-start">
        {SUPPORT_FORM_TEXT.back}
      </Link>
      <div>
        <h1 className="text-[26px] sm:text-[30px]">{SUPPORT_FORM_TEXT.title}</h1>
        <p className="mt-[6px] max-w-[60ch] text-[14px] ink-muted">{SUPPORT_FORM_TEXT.intro}</p>
      </div>
      <SupportRequestForm
        enquiries={enquiries.data}
        initialCategory={initialEnquiryId ? (initialCategory ?? 'ENQUIRY_ISSUE') : initialCategory}
        initialEnquiryId={initialEnquiryId}
      />
    </div>
  );
}
