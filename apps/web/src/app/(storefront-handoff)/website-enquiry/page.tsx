import {
  StorefrontEnquiryContext,
  StorefrontIntentParam,
  type PhoneOtpWidget,
} from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CustomerLogin } from '@/features/auth/login';
import { enquiryCustomerAction } from '@/features/enquiry/actions';
import { WebsiteEnquiry } from '@/features/storefront-enquiry/website-enquiry';
import { ApiError, apiGet, apiGetParsed } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Verified dealership enquiry',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function WebsiteEnquiryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ticket } = await searchParams;
  const parsed = StorefrontIntentParam.safeParse({ ticket });
  if (!parsed.success) notFound();
  let context: StorefrontEnquiryContext;
  try {
    context = await apiGetParsed(
      StorefrontEnquiryContext,
      `/v1/storefront/enquiry-intent/${encodeURIComponent(parsed.data.ticket)}`,
      { revalidate: false },
    );
  } catch (error) {
    if (error instanceof ApiError && [400, 401, 404].includes(error.status)) notFound();
    throw error;
  }
  const customer = await enquiryCustomerAction();
  let widget: PhoneOtpWidget | null = null;
  if (!customer) {
    try {
      widget = await apiGet<PhoneOtpWidget>('/v1/auth/sign-in/phone/widget', { revalidate: false });
    } catch {
      widget = null;
    }
  }
  return (
    <main className="mx-auto flex max-w-[680px] flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <p className="eyebrow">Verified contact through Dealers-Drive</p>
        <h1 className="mt-3 text-[32px] tracking-tight">Enquire with {context.dealerName}</h1>
        <p className="mt-3 text-[14px] ink-muted">
          Browsing is anonymous. To send an enquiry, use your verified customer account. Your
          inventory enquiry goes only to this dealership.
        </p>
      </div>
      {customer ? (
        <WebsiteEnquiry ticket={parsed.data.ticket} context={context} customer={customer} />
      ) : (
        <div className="card p-6">
          <CustomerLogin
            widget={widget}
            returnTo={`/website-enquiry?ticket=${encodeURIComponent(parsed.data.ticket)}`}
          />
          <a
            href={context.returnUrl}
            className="mt-5 inline-flex min-h-[44px] items-center text-[13px] underline"
          >
            Return to the car
          </a>
        </div>
      )}
      <p className="text-[12px] ink-muted">
        Website enquiry services are provided by Dealers-Drive for this dealership.
      </p>
    </main>
  );
}
