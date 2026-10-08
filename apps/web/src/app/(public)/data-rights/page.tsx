import { Uuid } from '@dealers-drive/contracts';
export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { LegalDocument } from '@/features/legal/legal-document';
import { legalMetadata } from '@/features/legal/legal-metadata';
import { legalPagesVisible } from '@/lib/legal-release';
import { RightsControls } from '@/features/legal/rights-controls';
export const metadata = legalMetadata('rights');
export default async function LegalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const enquiry = Uuid.safeParse(params.enquiry);
  if (!legalPagesVisible()) notFound();
  return (
    <LegalDocument
      documentId="rights"
      controls={<RightsControls enquiryId={enquiry.success ? enquiry.data : undefined} />}
    />
  );
}
