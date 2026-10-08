import { StorefrontAbout } from '@dealers-drive/storefront-ui';

import { siteMetadata } from '@/lib/seo';
import { getSite } from '@/lib/tenant';

export async function generateMetadata() {
  const site = await getSite();
  return siteMetadata(site, '/about', `Our dealership | ${site.name}`);
}
export default async function AboutPage() {
  return <StorefrontAbout site={await getSite()} />;
}
