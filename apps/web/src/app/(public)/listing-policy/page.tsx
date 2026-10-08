export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { LegalDocument } from '@/features/legal/legal-document';
import { legalMetadata } from '@/features/legal/legal-metadata';
import { legalPagesVisible } from '@/lib/legal-release';

export const metadata = legalMetadata('listing');
export default function LegalPage() {
  if (!legalPagesVisible()) notFound();
  return <LegalDocument documentId="listing" />;
}
