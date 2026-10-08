import { StorefrontVehicle } from '@dealers-drive/storefront-ui';

import { serializeStructuredData, siteMetadata, vehicleData } from '@/lib/seo';
import { getCar, getInventory, getSite } from '@/lib/tenant';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [site, car] = await Promise.all([getSite(), getCar(slug)]);
  return siteMetadata(site, `/car/${encodeURIComponent(slug)}`, `${car.title} | ${site.name}`);
}
export default async function VehiclePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [site, car, related] = await Promise.all([
    getSite(),
    getCar(slug),
    getInventory({ limit: '4' }),
  ]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(vehicleData(site, car)) }}
      />
      <StorefrontVehicle site={site} car={car} related={related} />
    </>
  );
}
