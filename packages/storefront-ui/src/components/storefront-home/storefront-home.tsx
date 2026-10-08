import type { PublicStorefrontDto, StorefrontInventoryResponse } from '@dealers-drive/contracts';

import { StorefrontCard } from '../storefront-card/storefront-card';
import { StorefrontImage } from '../storefront-image/storefront-image';

export function StorefrontHome({
  site,
  inventory,
}: {
  site: PublicStorefrontDto;
  inventory: StorefrontInventoryResponse;
}) {
  const firstPhoto = inventory.data.find((car) => car.image)?.image;
  return (
    <>
      <section className="wl-hero">
        <div className="wl-wrap wl-hero-grid">
          <div className="wl-hero-copy">
            <p className="wl-eyebrow">
              {site.city ? `${site.city} · ` : ''}
              {site.name}
            </p>
            <h1>{site.headline}</h1>
            {site.description ? (
              <p className="wl-lead">{site.description}</p>
            ) : (
              <p className="wl-lead">
                Explore our available cars and find the one that feels right for you.
              </p>
            )}
            <div className="wl-actions">
              <a className="wl-button" href="/cars">
                Explore our inventory <span aria-hidden="true">↗</span>
              </a>
              <a className="wl-text-link" href="/contact">
                Plan your visit
              </a>
            </div>
            <form
              action="/cars"
              method="get"
              className="wl-home-search"
              aria-label="Search our cars"
            >
              <label htmlFor="wl-home-search">Search our inventory</label>
              <div>
                <input
                  id="wl-home-search"
                  name="q"
                  type="search"
                  maxLength={120}
                  placeholder="Make, model or variant"
                />
                <button className="wl-button" type="submit">
                  Search
                </button>
              </div>
            </form>
            <div className="wl-hero-notes">
              {site.isVerified ? <span>✓ Verified dealership on Dealers-Drive</span> : null}
              <span>{inventory.page.total} cars in our current inventory</span>
            </div>
          </div>
          <div className="wl-hero-photo">
            <StorefrontImage
              src={site.heroUrl ?? firstPhoto?.url ?? null}
              alt={
                site.heroUrl
                  ? `${site.name} dealership`
                  : (firstPhoto?.alt ?? `${site.name} photography unavailable`)
              }
              priority
            />
            <div className="wl-photo-caption">
              <span>Discover your next chapter</span>
              <span>{site.city ?? site.name}</span>
            </div>
          </div>
        </div>
      </section>
      <section className="wl-wrap wl-section" aria-labelledby="wl-recent">
        <div className="wl-section-heading">
          <div>
            <p className="wl-eyebrow">Latest from our yard</p>
            <h2 id="wl-recent">Our latest arrivals</h2>
          </div>
          <a className="wl-text-link" href="/cars">
            View all cars ↗
          </a>
        </div>
        {inventory.data.length ? (
          <div className="wl-car-grid">
            {inventory.data.slice(0, 6).map((car) => (
              <StorefrontCard key={car.slug} car={car} />
            ))}
          </div>
        ) : (
          <div className="wl-empty">
            <h3>New arrivals are on their way</h3>
            <p>Contact our dealership to discuss what you are looking for.</p>
            <a href="/contact" className="wl-button">
              Contact us
            </a>
          </div>
        )}
      </section>
      <section className="wl-intro">
        <div className="wl-wrap wl-intro-grid">
          <div>
            <p className="wl-eyebrow">A dealership you can meet</p>
            <h2>
              Local knowledge.
              <br />
              Your next car.
            </h2>
          </div>
          <div>
            <p className="wl-lead">
              {site.about ||
                `Get to know ${site.name}. Visit our yard to see the vehicles and talk through your requirements.`}
            </p>
            <a className="wl-text-link" href="/about">
              Meet our dealership ↗
            </a>
          </div>
        </div>
        {site.yardUrls.length ? (
          <div className="wl-wrap wl-yard-grid">
            {site.yardUrls.map((url, index) => (
              <StorefrontImage
                key={url}
                src={url}
                alt={`${site.name} yard photograph ${index + 1}`}
              />
            ))}
          </div>
        ) : null}
      </section>
      <section className="wl-wrap wl-section">
        <div className="wl-visit-band">
          <div>
            <p className="wl-eyebrow">Ready when you are</p>
            <h2>Find a car. Make it your journey.</h2>
            <p>{site.address || `Visit ${site.name} and explore our inventory in person.`}</p>
          </div>
          <div className="wl-actions">
            <a className="wl-button" href="/contact">
              Visit & contact
            </a>
            {site.whatsappPhone ? (
              <a
                className="wl-button wl-button-outline"
                href={`https://wa.me/${site.whatsappPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp us
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
