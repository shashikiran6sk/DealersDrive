import type { Metadata } from 'next';

import { ComingSoon } from '@/components/public/coming-soon';
import { seoMetadata } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Saved cars — coming soon',
  description:
    'Saved cars are coming soon to Dealers-Drive. Explore verified independent dealers in the meantime.',
  ...seoMetadata({ kind: 'resolved', canonical: '/saved', isIndexable: false }),
};

export default function SavedCarsPage() {
  return (
    <ComingSoon
      eyebrow="Your shortlist"
      title="Save the cars you love — coming soon"
      description="We are building an easy way to keep your favourite vehicles together while you compare your options. Your saved cars will stay on your device, with no buyer account or sign-in required."
    />
  );
}
