import { AdminCallLeadsResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { CALL_LEAD_TEXT, CallLeadList } from '@/components/leads/call-lead-list';
import { ENQUIRY_OVERSIGHT_PATH } from '@/features/admin/enquiry-oversight';
import { apiGetParsed, qs } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: CALL_LEAD_TEXT.title };

const CALLS_PATH = `${ENQUIRY_OVERSIGHT_PATH}/calls`;

function one(value: string | string[] | undefined, max: number): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, max) : undefined;
}

export default async function AdminCallLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const dealer = one(params.dealer, 160);
  const leads = await apiGetParsed(
    AdminCallLeadsResponse,
    `/v1/admin/call-leads${qs({ dealer, cursor: one(params.cursor, 500) })}`,
    { revalidate: false },
  );
  const next = leads.page.nextCursor;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-[6px]">
        <Link href={ENQUIRY_OVERSIGHT_PATH} className="text-[13px] ink-muted">
          {CALL_LEAD_TEXT.backToEnquiries}
        </Link>
        <h1 className="text-[26px]">{CALL_LEAD_TEXT.title}</h1>
        <p className="max-w-[72ch] text-[13px] ink-muted">{CALL_LEAD_TEXT.adminIntro}</p>
      </div>
      <CallLeadList
        leads={leads.data}
        audience="admin"
        nextHref={next ? `${CALLS_PATH}${qs({ dealer, cursor: next })}` : null}
      />
    </div>
  );
}
