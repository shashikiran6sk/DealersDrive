import { PRIVACY_V1 } from '@dealers-drive/contracts';
import { notFound } from 'next/navigation';

import { LegalDocument } from '@/components/layout/legal-document';
import { legalPagesVisible } from '@/lib/legal';
import { pageMetadata } from '@/lib/seo';

export function generateMetadata() {
  return pageMetadata({
    title: PRIVACY_V1.title,
    description: PRIVACY_V1.description,
    route: { kind: 'resolved', canonical: '/privacy', isIndexable: legalPagesVisible() },
  });
}

export default function LegalPage() {
  if (!legalPagesVisible()) notFound();
  return <LegalDocument document={PRIVACY_V1} />;
}
