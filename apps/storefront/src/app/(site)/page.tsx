import { StorefrontHome } from '@dealers-drive/storefront-ui';

import { businessData, serializeStructuredData, siteMetadata } from '@/lib/seo';
import { getInventory, getSite } from '@/lib/tenant';

export async function generateMetadata() {
  return siteMetadata(await getSite());
}
export default async function HomePage() {
  const [site, inventory] = await Promise.all([getSite(), getInventory({ limit: '6' })]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(businessData(site)) }}
      />
      <StorefrontHome site={site} inventory={inventory} />
    </>
  );
}
