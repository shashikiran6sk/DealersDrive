import type { PublicStorefrontDto } from '@dealers-drive/contracts';

import { StorefrontImage } from '../storefront-image/storefront-image';

export function StorefrontAbout({ site }: { site: PublicStorefrontDto }) {
  return (
    <section className="wl-wrap wl-section">
      <div className="wl-about-grid">
        <div>
          <p className="wl-eyebrow">Our dealership</p>
          <h1>Welcome to {site.name}</h1>
          <p className="wl-lead wl-preserve">
            {site.about ||
              `Explore our inventory online, then visit ${site.name} to meet our team and see the cars in person.`}
          </p>
          {site.isVerified ? (
            <p className="wl-verification">✓ Verified dealership on Dealers-Drive</p>
          ) : null}
          <p>Trading as {site.legalName}</p>
          <a className="wl-button" href="/contact">
            Plan a visit
          </a>
        </div>
        <StorefrontImage src={site.heroUrl} alt={`${site.name} dealership`} priority />
      </div>
      {site.yardUrls.length ? (
        <div className="wl-yard-grid">
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
  );
}
