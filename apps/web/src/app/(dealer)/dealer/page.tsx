import {
  canDealer,
  DealerDocumentsResponse,
  DealerProfile,
  type DashboardResponse,
  type DocumentRequirementGap,
} from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ADD_VEHICLE_HREF, ADD_VEHICLE_LABEL } from '@/components/dealer/console-nav';
import { RecentEnquiries, ViewsChart } from '@/components/dealer/dashboard-panels';
import { DashboardMetrics } from '@/components/dealer/dashboard-metrics';
import { ButtonLink } from '@/components/ui/button';
import { LinkPendingLabel } from '@/components/ui/link-pending';
import { Banner } from '@/components/ui/primitives';
import { DocumentsReminder, outstandingDocuments } from '@/features/dealer/documents-overview';
import { apiGet, apiGetParsed } from '@/lib/api';
import { currentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DealerDashboardPage() {
  const [dashboard, documentGaps] = await Promise.all([
    apiGet<DashboardResponse>('/v1/dealer/dashboard', { revalidate: false }),
    outstandingDocumentsOrNone(),
  ]);

  return (
    <div className="flex flex-col gap-[18px] px-4 py-[22px] md:px-8 md:py-[30px]">
      <div className="flex flex-wrap items-end justify-between gap-[12px]">
        <div>
          <h1 className="text-[25px] tracking-[-0.035em] md:text-[30px]">{dashboard.greeting}</h1>
          <p className="mt-1 text-[13px] ink-muted">{dashboard.subline}</p>
        </div>
        <ButtonLink href={ADD_VEHICLE_HREF} variant="primary" size="md">
          + {ADD_VEHICLE_LABEL}
        </ButtonLink>
      </div>

      <DocumentsReminder gaps={documentGaps} />

      {dashboard.alerts.map((alert) => (
        <Banner
          key={alert.type}
          tone="warn"
          action={
            <Link href={alert.href} className="relative btn btn-secondary text-[12px]">
              <LinkPendingLabel>Open</LinkPendingLabel>
            </Link>
          }
        >
          {alert.message}
        </Banner>
      ))}

      <DashboardMetrics stats={dashboard.stats} listingStats={dashboard.listingStats} />

      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))] max-md:[grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
        <ViewsChart chart={dashboard.viewsChart} />
        <RecentEnquiries enquiries={dashboard.recentEnquiries} />
      </div>
    </div>
  );
}

async function outstandingDocumentsOrNone(): Promise<DocumentRequirementGap[]> {
  const session = await currentSession();
  if (session?.dealer?.status !== 'ACTIVE') return [];
  if (!canDealer(session.permissions, 'document:upload')) return [];

  try {
    const [documents, dealer] = await Promise.all([
      apiGetParsed(DealerDocumentsResponse, '/v1/dealer/documents', { revalidate: false }),
      apiGetParsed(DealerProfile, '/v1/dealer', { revalidate: false }),
    ]);
    return outstandingDocuments(documents.data, dealer.gstin);
  } catch {
    return [];
  }
}
