import type { Metadata } from 'next';

import { SUPPORT_TEXT, SupportPage } from '@/features/support/support-page';
import { getPublicConfig } from '@/lib/public-config';

export const metadata: Metadata = {
  title: SUPPORT_TEXT.metaTitle,
  description: SUPPORT_TEXT.metaDescription,
  alternates: { canonical: '/contact' },
};

export default async function ContactPage() {
  const config = await getPublicConfig();

  return <SupportPage support={config.support} />;
}
