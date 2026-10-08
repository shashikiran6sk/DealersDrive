import { StorefrontPreviewResponse } from '@dealers-drive/contracts';
import { StorefrontHome, StorefrontShell } from '@dealers-drive/storefront-ui';
import type { Metadata } from 'next';

import { apiGetParsed } from '@/lib/api';
import '@dealers-drive/storefront-ui/styles.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Private website preview',
  robots: { index: false, follow: false },
};
export default async function WebsitePreviewPage() {
  const data = await apiGetParsed(StorefrontPreviewResponse, '/v1/dealer/storefront/preview', {
    revalidate: false,
  });
  const image = (url: string | null) => {
    if (!url) return null;
    const match = /\/by-media\/([0-9a-f-]+)\/(\d+)\.webp$/.exec(url);
    return match ? `/api/website/media/${match[1]}/${match[2]}.webp` : null;
  };
  const site = {
    ...data.site,
    heroUrl: image(data.site.heroUrl),
    logoUrl: image(data.site.logoUrl),
    yardUrls: data.site.yardUrls.flatMap((url) => (image(url) ? [image(url)!] : [])),
  };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <h1 className="text-[18px]">Private preview</h1>
        <a
          href="/dealer/website"
          className="inline-flex min-h-[44px] items-center text-[13px] underline"
        >
          Back to My Website
        </a>
      </div>
      <StorefrontShell site={site} preview>
        <StorefrontHome site={site} inventory={data.inventory} />
      </StorefrontShell>
    </div>
  );
}
