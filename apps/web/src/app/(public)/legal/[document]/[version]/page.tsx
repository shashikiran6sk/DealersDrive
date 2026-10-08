export const dynamic = 'force-dynamic';
import { legalDocumentSnapshot, LegalDocumentId } from '@dealers-drive/contracts';
import { notFound } from 'next/navigation';
import { LegalDocument } from '@/features/legal/legal-document';
import { legalMetadata } from '@/features/legal/legal-metadata';
import { legalPagesVisible } from '@/lib/legal-release';
type Params = Promise<{ document: string; version: string }>;
async function snapshot(params: Params) {
  const value = await params;
  const id = LegalDocumentId.safeParse(value.document);
  if (!legalPagesVisible() || !id.success || !legalDocumentSnapshot(id.data, value.version))
    notFound();
  return { id: id.data, version: value.version };
}
export async function generateMetadata({ params }: { params: Params }) {
  const document = await snapshot(params);
  return legalMetadata(document.id, true, document.version);
}
export default async function VersionPage({ params }: { params: Params }) {
  const document = await snapshot(params);
  return <LegalDocument documentId={document.id} version={document.version} archived />;
}
