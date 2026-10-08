import type { PublicStorefrontDto } from '@dealers-drive/contracts';

export function StorefrontContact({
  site,
  compact = false,
}: {
  site: PublicStorefrontDto;
  compact?: boolean;
}) {
  return (
    <section
      className={`wl-wrap wl-section ${compact ? 'wl-contact-compact' : ''}`}
      aria-labelledby="wl-contact-title"
    >
      <div className="wl-contact-grid">
        <div>
          <p className="wl-eyebrow">Let's talk cars</p>
          <h1 id="wl-contact-title">Visit {site.name}</h1>
          <p className="wl-lead">See the car, meet our team, and decide at your own pace.</p>
          <div className="wl-actions">
            {site.contactPhone ? (
              <a className="wl-button" href={`tel:${site.contactPhone}`}>
                Call the dealership
              </a>
            ) : null}
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
          {!site.contactPhone && !site.whatsappPhone ? (
            <p>
              Contact details are being updated. Vehicle enquiries remain available on each
              available car.
            </p>
          ) : null}
        </div>
        <div className="wl-contact-panel">
          <h2>Find our yard</h2>
          <address>{site.address || site.city || 'Contact us to arrange a visit.'}</address>
          {site.mapsUrl ? (
            <a
              className="wl-text-link"
              href={site.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open directions in Google Maps ↗
            </a>
          ) : null}
          {site.contactPhone ? (
            <p>
              <a href={`tel:${site.contactPhone}`}>{site.contactPhone}</a>
            </p>
          ) : null}
          <p className="wl-small">
            Enquiries share your verified contact details with this dealership through
            Dealers-Drive.
          </p>
        </div>
      </div>
    </section>
  );
}
