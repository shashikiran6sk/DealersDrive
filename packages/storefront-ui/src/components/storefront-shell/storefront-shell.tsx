import type { PublicStorefrontDto } from '@dealers-drive/contracts';
import type { CSSProperties, ReactNode } from 'react';

import { accentForeground } from '../../presentation';
import { StorefrontImage } from '../storefront-image/storefront-image';

export function StorefrontShell({
  site,
  children,
  preview = false,
}: {
  site: PublicStorefrontDto;
  children: ReactNode;
  preview?: boolean;
}) {
  const style: CSSProperties & { '--wl-accent': string; '--wl-accent-ink': string } = {
    '--wl-accent': site.accentColor,
    '--wl-accent-ink': accentForeground(site.accentColor),
  };
  return (
    <div className="wl-site" data-theme={site.theme.toLowerCase()} style={style} inert={preview}>
      <a href="#wl-main" className="wl-skip">
        Skip to content
      </a>
      {preview ? (
        <div className="wl-preview-banner">
          Private preview · Your website is not published by this preview
        </div>
      ) : null}
      <header className="wl-header">
        <div className="wl-wrap wl-header-inner">
          <a className="wl-brand" href="/" aria-label={`${site.name} home`}>
            {site.logoUrl ? (
              <StorefrontImage src={site.logoUrl} alt="" />
            ) : (
              <span className="wl-monogram" aria-hidden="true">
                {site.name.slice(0, 1)}
              </span>
            )}
            <span>{site.name}</span>
          </a>
          <nav className="wl-desktop-nav" aria-label="Main navigation">
            <a href="/cars">Our cars</a>
            <a href="/about">Our dealership</a>
            <a href="/contact">Contact</a>
            <a className="wl-button" href="/cars">
              Find your car
            </a>
          </nav>
          <details className="wl-mobile-nav">
            <summary aria-label="Open navigation">
              Menu <span aria-hidden="true">☰</span>
            </summary>
            <nav aria-label="Mobile navigation">
              <a href="/cars">Our cars</a>
              <a href="/about">Our dealership</a>
              <a href="/contact">Contact</a>
            </nav>
          </details>
        </div>
      </header>
      <main id="wl-main">{children}</main>
      <footer className="wl-footer">
        <div className="wl-wrap wl-footer-grid">
          <div>
            <p className="wl-eyebrow">Your next journey starts here</p>
            <p className="wl-footer-name">{site.name}</p>
            <p>{site.address || site.city || 'Visit our dealership'}</p>
          </div>
          <nav aria-label="Footer navigation">
            <a href="/cars">Browse inventory</a>
            <a href="/about">About us</a>
            <a href="/contact">Visit & contact</a>
            <a href="/privacy">Privacy information</a>
            <a href="/terms">Website information</a>
          </nav>
          <div>
            <p>Website services and verified customer enquiries provided by Dealers-Drive.</p>
            <p>{site.legalName}</p>
            {site.socialUrls.length ? (
              <div className="wl-socials">
                {site.socialUrls.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                    {new URL(url).hostname.replace(/^www\./, '')}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="wl-wrap wl-footer-bottom">
          © {new Date().getFullYear()} {site.name}. Vehicle availability is confirmed by the
          dealership.
        </div>
      </footer>
    </div>
  );
}
