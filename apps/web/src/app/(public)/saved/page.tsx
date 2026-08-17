import type { HomeResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { SavedCarsList } from '@/features/saved/saved-list';
import { apiGet } from '@/lib/api';
import { seoMetadata } from '@/lib/seo';

/** Device-scoped and personal — nothing to index (DESIGN-SPEC §3.7, §4.10). */
export const metadata: Metadata = {
  title: 'Saved cars',
  ...seoMetadata({ kind: 'private' }),
};

export default async function SavedCarsPage() {
  // The list itself is a client island, but the empty state's "Browse n cars"
  // is a derived count and must never be hard-coded (Rule 6, §4.11).
  const home = await apiGet<HomeResponse>('/v1/home', { revalidate: 300 });

  return (
    <div className="mx-auto max-w-[1280px] px-6 pb-[60px] pt-[26px]">
      <nav className="mb-[10px] text-[12px] ink-subtle" aria-label="Breadcrumb">
        <Link href="/">Home</Link> / Saved cars
      </nav>

      <h1 className="text-[34px]">Saved cars</h1>
      <p className="mb-[18px] mt-[6px] max-w-[62ch] text-[14px] ink-secondary">
        Saved cars live on this device only — there is no account to create and nothing to sign in
        to. Clearing your browser data clears this list.
      </p>

      <SavedCarsList activeCount={home.activeCount} />
    </div>
  );
}
