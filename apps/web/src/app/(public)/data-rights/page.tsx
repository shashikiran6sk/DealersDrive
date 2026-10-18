import { Uuid } from '@dealers-drive/contracts';
export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { RightsControls } from '@/features/legal/rights-controls';
import { legalPagesVisible } from '@/lib/legal-release';
export const metadata = { title: 'Privacy controls', robots: { index: false, follow: false } };
export default async function LegalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!legalPagesVisible()) notFound();
  const params = await searchParams;
  const enquiry = Uuid.safeParse(params.enquiry);
  return (
    <main className="mx-auto max-w-[900px] px-4 py-8">
      <RightsControls enquiryId={enquiry.success ? enquiry.data : undefined} />
    </main>
  );
}
