import { StorefrontShell } from '@dealers-drive/storefront-ui';
import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { primaryUrl } from '@/lib/hostname';
import { getSite } from '@/lib/tenant';

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const site = await getSite();
  if (site.requestedHostname !== site.primaryHostname) {
    const incoming = await headers();
    permanentRedirect(
      primaryUrl(
        site.primaryHostname,
        incoming.get('x-dd-pathname') ?? '/',
        incoming.get('x-dd-search') ?? '',
      ),
    );
  }
  return <StorefrontShell site={site}>{children}</StorefrontShell>;
}
