import { TERMS_V1 } from '@dealers-drive/contracts';
import { notFound } from 'next/navigation';

import { LegalDocument } from '@/components/layout/legal-document';
import { legalPagesVisible } from '@/lib/legal';
import { pageMetadata } from '@/lib/seo';

export function generateMetadata() {
  return pageMetadata({
    title: TERMS_V1.title,
    description: TERMS_V1.description,
    route: { kind: 'resolved', canonical: '/terms', isIndexable: legalPagesVisible() },
  });
}

export default function LegalPage() {
  if (!legalPagesVisible()) notFound();
  return <LegalDocument document={TERMS_V1} />;
}
