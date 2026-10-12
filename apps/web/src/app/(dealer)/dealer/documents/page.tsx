import { canDealer, DealerDocumentsResponse, DealerProfile } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { DOCUMENTS_TEXT, DocumentsOverview } from '@/features/dealer/documents-overview';
import { apiGetParsed } from '@/lib/api';
import { currentSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const DEALER_HOME = '/dealer';

export const metadata: Metadata = { title: DOCUMENTS_TEXT.title };

export default async function DealerDocumentsPage() {
  const session = await currentSession();
  if (!canDealer(session?.permissions, 'document:upload')) redirect(DEALER_HOME);

  const [documents, dealer] = await Promise.all([
    apiGetParsed(DealerDocumentsResponse, '/v1/dealer/documents', { revalidate: false }),
    apiGetParsed(DealerProfile, '/v1/dealer', { revalidate: false }),
  ]);

  return (
    <div className="px-4 py-[22px] md:px-8 md:py-[30px]">
      <DocumentsOverview
        documents={documents.data}
        gstin={dealer.gstin}
        dealerStatus={dealer.status}
      />
    </div>
  );
}
