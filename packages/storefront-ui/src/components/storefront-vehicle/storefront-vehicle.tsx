import type {
  PublicStorefrontDto,
  StorefrontInventoryResponse,
  StorefrontVehicleResponse,
} from '@dealers-drive/contracts';

import { StorefrontCard } from '../storefront-card/storefront-card';
import { StorefrontGallery } from '../storefront-gallery/storefront-gallery';

export function StorefrontVehicle({
  site,
  car,
  related,
}: {
  site: PublicStorefrontDto;
  car: StorefrontVehicleResponse;
  related: StorefrontInventoryResponse;
}) {
  const available = car.availability === 'AVAILABLE';
  return (
    <section className="wl-wrap wl-section">
      <a href="/cars" className="wl-text-link">
        ← Back to our cars
      </a>
      <div className="wl-vehicle-grid">
        <StorefrontGallery images={car.images} title={car.title} primaryIndex={car.primaryIndex} />
        <div className="wl-vehicle-summary">
          <p className="wl-eyebrow">
            {car.year ?? 'Used car'} · {available ? 'Available' : 'Reserved'}
          </p>
          <h1>{car.title}</h1>
          <p className="wl-price">{car.priceLabel ?? 'Contact for price'}</p>
          {car.negotiabilityLabel ? <p>{car.negotiabilityLabel}</p> : null}
          <p>{car.summary}</p>
          <div className="wl-actions">
            {available ? (
              <a className="wl-button" href={`/enquire/${encodeURIComponent(car.slug)}`}>
                Enquire about this car
              </a>
            ) : (
              <p>This vehicle is currently reserved.</p>
            )}
            {available && site.contactPhone ? (
              <a className="wl-button wl-button-outline" href={`tel:${site.contactPhone}`}>
                Call dealership
              </a>
            ) : null}
            {available && site.whatsappPhone ? (
              <a
                className="wl-text-link"
                href={`https://wa.me/${site.whatsappPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`I am interested in ${car.title}: https://${site.primaryHostname}/car/${car.slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ask on WhatsApp ↗
              </a>
            ) : null}
          </div>
          <p className="wl-small">
            Enquiries use your verified mobile number through Dealers-Drive. Availability is
            confirmed by {site.name}.
          </p>
        </div>
      </div>
      <div className="wl-details-grid">
        <div>
          <h2>Vehicle specifications</h2>
          <dl className="wl-specs">
            {car.specs.map((spec) => (
              <div key={spec.label}>
                <dt>{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h2>About this car</h2>
          <p className="wl-preserve">
            {car.description || 'Contact our dealership for more information about this vehicle.'}
          </p>
          {car.publishedLabel ? <p className="wl-small">{car.publishedLabel}</p> : null}
        </div>
      </div>
      {related.data.some((item) => item.slug !== car.slug) ? (
        <section className="wl-section">
          <div className="wl-section-heading">
            <div>
              <p className="wl-eyebrow">More from our dealership</p>
              <h2>Explore our other cars</h2>
            </div>
          </div>
          <div className="wl-car-grid">
            {related.data
              .filter((item) => item.slug !== car.slug)
              .slice(0, 3)
              .map((item) => (
                <StorefrontCard key={item.slug} car={item} />
              ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
