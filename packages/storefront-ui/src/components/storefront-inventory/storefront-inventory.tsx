import type { StorefrontInventoryResponse } from '@dealers-drive/contracts';

import { StorefrontCard } from '../storefront-card/storefront-card';

export function StorefrontInventory({
  inventory,
  query = {},
}: {
  inventory: StorefrontInventoryResponse;
  query?: Readonly<Record<string, string | undefined>>;
}) {
  const pageHref = (page: number) => {
    const params = new URLSearchParams(
      Object.entries(query).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
    params.set('page', String(page));
    return `/cars?${params}`;
  };
  return (
    <section className="wl-wrap wl-section">
      <div className="wl-section-heading">
        <div>
          <p className="wl-eyebrow">Our inventory</p>
          <h1>Find your next car</h1>
          <p>
            {inventory.page.total} {inventory.page.total === 1 ? 'car' : 'cars'} matching your
            search
          </p>
        </div>
      </div>
      <form method="get" action="/cars" className="wl-filters" aria-label="Filter inventory">
        <label>
          Search
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="Make, model or variant"
            maxLength={120}
          />
        </label>
        <label>
          Fuel
          <select name="fuel" defaultValue={query.fuel ?? ''}>
            <option value="">Any fuel</option>
            <option value="petrol">Petrol</option>
            <option value="diesel">Diesel</option>
            <option value="cng">CNG</option>
            <option value="electric">Electric</option>
            <option value="hybrid">Hybrid</option>
            <option value="lpg">LPG</option>
          </select>
        </label>
        <label>
          Transmission
          <select name="transmission" defaultValue={query.transmission ?? ''}>
            <option value="">Any transmission</option>
            <option value="manual">Manual</option>
            <option value="automatic">Automatic</option>
          </select>
        </label>
        <label>
          Sort
          <select name="sort" defaultValue={query.sort ?? 'newest'}>
            <option value="newest">Latest arrivals</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="year_desc">Newest year</option>
            <option value="km_asc">Lowest mileage</option>
          </select>
        </label>
        <button type="submit" className="wl-button">
          Apply filters
        </button>
        <a href="/cars" className="wl-text-link">
          Reset
        </a>
      </form>
      {inventory.data.length ? (
        <div className="wl-car-grid">
          {inventory.data.map((car) => (
            <StorefrontCard key={car.slug} car={car} />
          ))}
        </div>
      ) : (
        <div className="wl-empty">
          <h2>No cars match these filters</h2>
          <p>Try a wider search or contact our dealership about what you need.</p>
          <a href="/cars" className="wl-button">
            Clear filters
          </a>
        </div>
      )}
      {inventory.page.totalPages > 1 ? (
        <nav className="wl-pagination" aria-label="Inventory pages">
          {inventory.page.page > 1 ? (
            <a className="wl-button wl-button-outline" href={pageHref(inventory.page.page - 1)}>
              Previous
            </a>
          ) : null}
          <span>
            Page {inventory.page.page} of {inventory.page.totalPages}
          </span>
          {inventory.page.page < inventory.page.totalPages ? (
            <a className="wl-button wl-button-outline" href={pageHref(inventory.page.page + 1)}>
              Next
            </a>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
