import { CustomerEnquiriesResponse, CustomerEnquiry } from '@dealers-drive/contracts';
import Link from 'next/link';
import { ApiError, apiGetParsed } from '@/lib/api';
import { legalEnforcementEnabled } from '@/lib/legal-release';
import { AgreementForm } from './agreement-form';
export async function RightsControls({ enquiryId }: { enquiryId?: string } = {}) {
  if (!legalEnforcementEnabled()) return null;
  let missing = false;
  let enquiries: CustomerEnquiriesResponse | null = null;
  try {
    enquiries = enquiryId
      ? {
          data: [
            await apiGetParsed(CustomerEnquiry, `/v1/enquiries/${enquiryId}`, {
              revalidate: false,
            }),
          ],
          page: { hasMore: false, nextCursor: null },
        }
      : await apiGetParsed(CustomerEnquiriesResponse, '/v1/enquiries?limit=50', {
          revalidate: false,
        });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) missing = true;
    if (!(error instanceof ApiError && [401, 404].includes(error.status))) throw error;
  }
  return (
    <section aria-labelledby="rights-controls" className="border-t border-(--color-divider) pt-6">
      <h2 id="rights-controls" className="mb-4 text-[20px] font-bold">
        Make a request or change sharing
      </h2>
      <p className="mb-4 text-[14px] leading-[1.8]">
        <Link
          href="/support-requests/new?category=ACCOUNT_ISSUE&subject=Privacy%20request"
          className="underline"
        >
          Request access, correction or account deletion
        </Link>
        . Explain your request in a support ticket. We may verify your identity and need to preserve
        records required by law or a dispute. Declining new Terms does not block this channel. For
        help without an account, use{' '}
        <Link href="/contact" className="underline">
          Contact & support
        </Link>
        .
      </p>
      <p className="mb-4 text-[13px]">
        <Link href="/agreements" className="underline">
          View your agreement and sharing history
        </Link>
        .
      </p>
      {enquiries ? (
        <>
          <p className="mb-4 text-[13px]">
            {enquiryId
              ? 'Your selected enquiry is shown below.'
              : 'Your 50 most recent enquiries are shown below.'}{' '}
            Use your{' '}
            <Link href="/enquiries" className="underline">
              enquiry history
            </Link>{' '}
            or support for an older enquiry.
          </p>
          {enquiries.data.map((enquiry) => (
            <div key={enquiry.id} className="mb-6 border-t border-(--color-divider) pt-5">
              <h3 className="mb-2 text-[16px] font-semibold">
                {enquiry.vehicle.title} — {enquiry.dealerName}
              </h3>
              <p className="mb-3 text-[12px] ink-subtle">Sent {enquiry.createdLabel}</p>
              <AgreementForm kind="withdraw" subjectId={enquiry.id} />
            </div>
          ))}
        </>
      ) : missing ? (
        <p className="text-[14px]">
          This enquiry is unavailable for your account.{' '}
          <Link href="/enquiries" className="underline">
            Open your enquiry history
          </Link>{' '}
          or contact support.
        </p>
      ) : (
        <p className="text-[14px]">
          <Link
            href={`/login?returnTo=${encodeURIComponent(`/data-rights${enquiryId ? `?enquiry=${enquiryId}` : ''}`)}`}
            className="underline"
          >
            Sign in
          </Link>{' '}
          to change sharing for your own enquiries.
        </p>
      )}
    </section>
  );
}
