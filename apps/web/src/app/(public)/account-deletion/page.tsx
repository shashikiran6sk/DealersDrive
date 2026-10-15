import { CustomerSession, CUSTOMER_ACCOUNT_TEXT } from '@dealers-drive/contracts';
import Link from 'next/link';
import { ApiError, apiGetParsed } from '@/lib/api';
import { getPublicConfig } from '@/lib/public-config';
import { DeletionRequest } from '@/features/account/deletion-request';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: CUSTOMER_ACCOUNT_TEXT.deletionMetaTitle,
  robots: { index: false, follow: true },
};
export default async function AccountDeletionPage() {
  let customerId: string | null = null;
  try {
    customerId = (
      await apiGetParsed(CustomerSession, '/v1/auth/customer/me', { revalidate: false })
    ).customer.id;
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) customerId = null;
  }
  const config = await getPublicConfig();
  const email = config.support.customer.email;
  return (
    <main className="mx-auto max-w-[700px] px-4 py-8">
      <h1 className="mb-4 text-[28px] font-extrabold">
        {CUSTOMER_ACCOUNT_TEXT.appName} · {CUSTOMER_ACCOUNT_TEXT.delete}
      </h1>
      <p className="mb-4 text-[14px] leading-[1.8]">{CUSTOMER_ACCOUNT_TEXT.withoutAccount}</p>
      {customerId ? (
        <DeletionRequest key={customerId} customerId={customerId} />
      ) : (
        <>
          <p className="my-4 text-[14px] leading-[1.8]">{CUSTOMER_ACCOUNT_TEXT.deletionBody}</p>
          <Link className="underline" href="/login?returnTo=%2Faccount-deletion">
            {CUSTOMER_ACCOUNT_TEXT.freshOtp}
          </Link>
        </>
      )}
      <p className="my-4 text-[14px] leading-[1.8]">{CUSTOMER_ACCOUNT_TEXT.externalInstructions}</p>
      <>
        {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? (
          <a
            className="underline"
            href={`mailto:${email}?subject=${encodeURIComponent(CUSTOMER_ACCOUNT_TEXT.deletionSubject)}`}
          >
            {email}
          </a>
        ) : (
          <p role="alert">{CUSTOMER_ACCOUNT_TEXT.contactUnavailable}</p>
        )}
        <Link className="ml-3 underline" href="/contact">
          {CUSTOMER_ACCOUNT_TEXT.external}
        </Link>
      </>
      <p className="mt-4 text-[14px] leading-[1.8]">{CUSTOMER_ACCOUNT_TEXT.records}</p>
      <Link className="underline" href="/privacy">
        {CUSTOMER_ACCOUNT_TEXT.privacy}
      </Link>
    </main>
  );
}
