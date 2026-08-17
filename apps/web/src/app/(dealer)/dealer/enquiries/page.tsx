import type { EnquiryCountsResponse, EnquiryListResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import { EnquiryInbox } from '@/features/enquiries/inbox';
import { QueryProvider } from '@/features/query/query-provider';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Enquiries' };

/**
 * DESIGN-SPEC §3.15 — RSC shell, client tabs (ARCHITECTURE §15.1).
 *
 * The counts and the first tab's rows are server-rendered so the inbox is
 * useful on first paint; everything after that is a client fetch.
 */
export default async function DealerEnquiriesPage() {
  const [counts, first] = await Promise.all([
    apiGet<EnquiryCountsResponse>('/v1/dealer/enquiries/counts', { revalidate: false }),
    apiGet<EnquiryListResponse>('/v1/dealer/enquiries?status=NEW&limit=50', {
      revalidate: false,
    }),
  ]);

  return (
    <div className="flex flex-col gap-[14px] p-[22px]">
      <h1 className="text-[26px]">Enquiries</h1>

      <QueryProvider>
        <EnquiryInbox initialCounts={counts} initialStatus="NEW" initialData={first} />
      </QueryProvider>
    </div>
  );
}
