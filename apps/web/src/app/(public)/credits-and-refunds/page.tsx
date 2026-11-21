import { notFound } from 'next/navigation';

import { LegalDocument } from '@/components/layout/legal-document';
import { CREDITS_POLICY } from '@/features/dealer/billing';
import { legalPagesVisible } from '@/lib/legal';
import { pageMetadata } from '@/lib/seo';

export function generateMetadata() {
  return pageMetadata({
    title: CREDITS_POLICY.title,
    description: CREDITS_POLICY.description,
    route: {
      kind: 'resolved',
      canonical: CREDITS_POLICY.route,
      isIndexable: legalPagesVisible(),
    },
  });
}

export default function CreditsPolicyPage() {
  if (!legalPagesVisible()) notFound();
  return <LegalDocument document={CREDITS_POLICY} />;
}
