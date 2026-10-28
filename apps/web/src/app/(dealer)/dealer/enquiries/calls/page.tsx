import { CallLeadsResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { CALL_LEAD_TEXT, CallLeadList } from '@/components/leads/call-lead-list';
import { ENQUIRIES_PATH } from '@/features/dealer/enquiries';
import { apiGetParsed, qs } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: CALL_LEAD_TEXT.title };

const CALLS_PATH = `${ENQUIRIES_PATH}/calls`;

export default async function DealerCallLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { cursor } = await searchParams;
  const leads = await apiGetParsed(
    CallLeadsResponse,
    `/v1/dealer/call-leads${qs({ cursor: typeof cursor === 'string' ? cursor : undefined })}`,
    { revalidate: false },
  );
  const next = leads.page.nextCursor;

  return (
    <div className="flex flex-col gap-[18px] px-4 py-[22px] md:px-8 md:py-[30px]">
      <div className="flex flex-col gap-[6px]">
        <Link href={ENQUIRIES_PATH} className="text-[13px] ink-muted">
          {CALL_LEAD_TEXT.backToEnquiries}
        </Link>
        <h1 className="text-[25px] tracking-[-0.035em] md:text-[30px]">{CALL_LEAD_TEXT.title}</h1>
        <p className="max-w-[72ch] text-[13px] ink-muted">{CALL_LEAD_TEXT.dealerIntro}</p>
      </div>
      <CallLeadList
        leads={leads.data}
        audience="dealer"
        nextHref={next ? `${CALLS_PATH}${qs({ cursor: next })}` : null}
      />
    </div>
  );
}
