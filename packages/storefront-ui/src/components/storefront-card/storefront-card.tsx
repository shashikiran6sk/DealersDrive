import type { VehicleCardDto } from '@dealers-drive/contracts';

import { StorefrontImage } from '../storefront-image/storefront-image';

export function StorefrontCard({ car }: { car: VehicleCardDto }) {
  const available = car.availability === 'AVAILABLE';
  const content = (
    <>
      <div className="wl-card-photo">
        <StorefrontImage
          src={car.image?.url ?? null}
          alt={car.image?.alt ?? `${car.title} photograph unavailable`}
        />
        <span className={`wl-stock-badge ${available ? '' : 'wl-reserved'}`}>
          {available ? 'Available' : 'Reserved'}
        </span>
      </div>
      <div className="wl-card-body">
        <p className="wl-eyebrow">{car.year ?? 'Used car'}</p>
        <h3>{car.title}</h3>
        <p className="wl-card-meta">{car.metaLabel}</p>
        <div className="wl-card-bottom">
          <strong>{car.priceLabel ?? 'Contact for price'}</strong>
          <span>{available ? 'View car ↗' : 'Currently reserved'}</span>
        </div>
      </div>
    </>
  );
  return (
    <article className={`wl-car-card ${available ? '' : 'wl-card-unavailable'}`}>
      {available ? (
        <a href={`/car/${encodeURIComponent(car.slug)}`}>{content}</a>
      ) : (
        <div>{content}</div>
      )}
    </article>
  );
}
