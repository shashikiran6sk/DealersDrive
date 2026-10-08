import { StorefrontContact } from '@dealers-drive/storefront-ui';

import { siteMetadata } from '@/lib/seo';
import { getSite } from '@/lib/tenant';

export async function generateMetadata() {
  const site = await getSite();
  return siteMetadata(site, '/contact', `Visit & contact | ${site.name}`);
}
export default async function ContactPage() {
  return <StorefrontContact site={await getSite()} />;
}
