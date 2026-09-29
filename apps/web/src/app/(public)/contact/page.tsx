import type { Metadata } from 'next';

import { SUPPORT_TEXT, SupportPage } from '@/features/support/support-page';
import { getPublicConfig } from '@/lib/public-config';
import { pageMetadata } from '@/lib/seo';

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: SUPPORT_TEXT.metaTitle,
    description: SUPPORT_TEXT.metaDescription,
    route: { kind: 'resolved', canonical: '/contact', isIndexable: true },
  });
}

export default async function ContactPage() {
  const config = await getPublicConfig();

  return <SupportPage support={config.support} />;
}
