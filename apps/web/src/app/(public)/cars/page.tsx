import type { Metadata } from 'next';

import { ComingSoon } from '@/components/public/coming-soon';
import { seoMetadata } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Used cars — coming soon',
  description:
    'The Dealers-Drive vehicle marketplace is coming soon. Explore verified independent dealers in the meantime.',
  ...seoMetadata({ kind: 'resolved', canonical: '/cars', isIndexable: false }),
};

export default function CarsPage() {
  return (
    <ComingSoon
      eyebrow="Vehicle marketplace"
      title="A better way to find your next car is coming soon"
      description="We are preparing a clear, trustworthy way to browse used cars from verified independent dealerships. Soon you will be able to search, compare and contact the dealer behind every vehicle directly."
    />
  );
}
