import { StorefrontInventory } from '@dealers-drive/storefront-ui';

import { StorefrontApiError } from '@/lib/api';
import { siteMetadata } from '@/lib/seo';
import { getInventory, getSite } from '@/lib/tenant';

export async function generateMetadata() {
  const site = await getSite();
  return siteMetadata(site, '/cars', `Our cars | ${site.name}`);
}
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  try {
    const inventory = await getInventory(query);
    const display = Object.fromEntries(
      Object.entries(query).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(',') : value,
      ]),
    );
    return <StorefrontInventory inventory={inventory} query={display} />;
  } catch (error) {
    if (error instanceof StorefrontApiError && error.status === 400)
      return (
        <section className="wl-wrap wl-section">
          <div className="wl-empty">
            <h1>Check your filters</h1>
            <p>Some filters are invalid. Clear them and try a new search.</p>
            <a className="wl-button" href="/cars">
              Clear filters
            </a>
          </div>
        </section>
      );
    throw error;
  }
}
