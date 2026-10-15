import {
  CustomerAccountStatus,
  CustomerSession,
  CUSTOMER_ACCOUNT_TEXT,
} from '@dealers-drive/contracts';
import Link from 'next/link';
import { ApiError, apiGetParsed } from '@/lib/api';
import { AccountControlsHost } from '@/features/account/account-controls-host';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: CUSTOMER_ACCOUNT_TEXT.title,
  robots: { index: false, follow: false },
};
export default async function AccountPage() {
  let session: CustomerSession | null = null;
  let canDeactivate = false;
  let failed = false;
  try {
    const [status, current] = await Promise.all([
      apiGetParsed(CustomerAccountStatus, '/v1/auth/customer/account', { revalidate: false }),
      apiGetParsed(CustomerSession, '/v1/auth/customer/me', { revalidate: false }),
    ]);
    session = current;
    canDeactivate = status.canDeactivate;
  } catch (error) {
    failed = !(error instanceof ApiError && error.status === 401);
  }
  return (
    <main className="mx-auto max-w-[700px] px-4 py-8">
      <h1 className="mb-4 text-[28px] font-extrabold">{CUSTOMER_ACCOUNT_TEXT.title}</h1>
      {session ? (
        <p className="mb-4">
          {session.customer.fullName} · {session.customer.phoneDisplay}
        </p>
      ) : null}
      {failed ? <p role="alert">{CUSTOMER_ACCOUNT_TEXT.failed}</p> : null}
      <AccountControlsHost
        customerId={session?.customer.id ?? null}
        canDeactivate={canDeactivate}
      />
      <p className="my-4">{CUSTOMER_ACCOUNT_TEXT.withoutAccount}</p>
      <Link className="underline" href="/account-deletion">
        {CUSTOMER_ACCOUNT_TEXT.delete}
      </Link>
    </main>
  );
}
