import { DealerVehicle, LEGAL_DOCUMENTS, Uuid } from '@dealers-drive/contracts';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AgreementForm } from '@/features/legal/agreement-form';
import { legalAccount } from '@/features/legal/legal-account';
import { apiGetParsed } from '@/lib/api';
import { legalPagesVisible } from '@/lib/legal-release';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'My agreements', robots: { index: false, follow: false } };
export default async function AgreementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!legalPagesVisible()) notFound();
  const account = await legalAccount();
  if (!account) redirect('/login?returnTo=%2Fagreements');
  const params = await searchParams;
  const id = Uuid.safeParse(params.vehicle);
  const assisted =
    id.success && account.base.endsWith('/dealer') && account.status.mayBindDealer
      ? await apiGetParsed(DealerVehicle, `/v1/dealer/vehicles/${id.data}`, { revalidate: false })
      : null;
  return (
    <div className="mx-auto max-w-[840px] px-4 py-10 sm:px-6">
      <h1 className="text-[30px] font-extrabold">My agreements</h1>
      <p className="mt-3 text-[15px] leading-[1.8]">
        Review the documents and your recorded choices. Login,{' '}
        <Link href="/contact" className="underline">
          support
        </Link>{' '}
        and{' '}
        <Link href="/data-rights" className="underline">
          privacy requests
        </Link>{' '}
        remain available if you decline new Terms.
      </p>
      {!account.status.enabled ? (
        <p className="mt-6 text-[14px]">
          Draft review only. Agreement collection is not active for this deployment.
        </p>
      ) : (
        <>
          {account.status.termsRequired ? (
            <section className="mt-7">
              <h2 className="mb-4 text-[20px] font-bold">Your account</h2>
              <AgreementForm kind="account" />
            </section>
          ) : (
            <p className="mt-6">
              You have accepted the current Terms and acknowledged the Privacy Policy.
            </p>
          )}
          {account.base.endsWith('/dealer') && account.status.dealerRequired ? (
            <section className="mt-7">
              <h2 className="mb-4 text-[20px] font-bold">Your active dealership</h2>
              {account.status.mayBindDealer ? (
                <AgreementForm kind="dealer" />
              ) : (
                <p className="text-[14px] leading-[1.8]">
                  An active dealership owner authorized to bind the business must accept its Dealer
                  Agreement. Ask the owner to open this page after entering the correct workspace.
                  You may accept your own account Terms.
                </p>
              )}
            </section>
          ) : null}
          {assisted ? (
            <section className="mt-7 border-t border-(--color-divider) pt-6">
              <h2 className="mb-3 text-[20px] font-bold">Certify an assisted draft</h2>
              <p className="mb-4 text-[14px]">
                <Link
                  href={`/dealer/vehicles/${assisted.id}/edit?step=review`}
                  className="underline"
                >
                  Review {assisted.registrationNumber} and all listing information
                </Link>{' '}
                before certifying it. This choice permits the sales representative to submit this
                exact draft. Editing it requires a fresh certification.
              </p>
              <AgreementForm kind="certification" subjectId={assisted.id} />
            </section>
          ) : null}
        </>
      )}
      <section className="mt-8 border-t border-(--color-divider) pt-6">
        <h2 className="mb-4 text-[20px] font-bold">Your recent records</h2>
        <p className="mb-4 text-[13px] ink-subtle">
          Up to 100 recent records are shown. No acceptance has been backdated. Request a fuller
          copy through support if needed.
        </p>
        <ol className="space-y-5">
          {account.history.data.map((receipt) => {
            const document = Object.values(LEGAL_DOCUMENTS).find(
              (item) => item.id === receipt.documentId,
            );
            return (
              <li key={receipt.id} className="border-b border-(--color-divider) pb-4 text-[14px]">
                <p className="font-semibold">
                  {receipt.documentId === 'enquiry'
                    ? 'Enquiry sharing'
                    : receipt.documentId === 'certification'
                      ? 'Listing declaration'
                      : (document?.title ?? receipt.documentId)}{' '}
                  —{' '}
                  {receipt.action === 'ACKNOWLEDGE'
                    ? 'notice acknowledged'
                    : receipt.action === 'ACCEPT'
                      ? 'accepted'
                      : receipt.action === 'WITHDRAW'
                        ? 'withdrawn'
                        : receipt.action === 'GRANT'
                          ? 'permitted'
                          : 'certified'}
                </p>
                <p className="mt-1 text-[12px] ink-subtle">
                  Version {receipt.version} ·{' '}
                  <time dateTime={receipt.createdAt}>
                    {new Date(receipt.createdAt)
                      .toISOString()
                      .replace('T', ' ')
                      .replace('.000Z', ' UTC')}
                  </time>
                </p>
                {document ? (
                  <Link
                    href={`/legal/${document.id}/${receipt.version}`}
                    className="mt-2 inline-block text-[13px] underline"
                  >
                    Read the recorded document
                  </Link>
                ) : null}
                {receipt.documentId === 'enquiry' || receipt.documentId === 'certification' ? (
                  <Link
                    href={`/legal/notices/${receipt.documentId}/${receipt.version}`}
                    className="mt-2 inline-block text-[13px] underline"
                  >
                    Read the recorded notice
                  </Link>
                ) : null}
                <details className="mt-2 text-[12px]">
                  <summary>Receipt details</summary>
                  <p className="mt-2 break-all">
                    Receipt {receipt.id}
                    <br />
                    Document fingerprint {receipt.digest}
                  </p>
                </details>
              </li>
            );
          })}
        </ol>
        {account.history.data.length === 0 ? (
          <p className="text-[14px]">No records are available yet.</p>
        ) : null}
      </section>
    </div>
  );
}
