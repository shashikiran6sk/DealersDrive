import type { PublicStorefrontDto, StorefrontVehicleResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import { primaryUrl } from './hostname';

export function siteMetadata(
  site: PublicStorefrontDto,
  path = '/',
  title = site.seoTitle,
): Metadata {
  const url = primaryUrl(site.primaryHostname, path);
  const description =
    site.seoDescription ||
    `Explore the available cars at ${site.name}${site.city ? ` in ${site.city}` : ''}.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: process.env.APP_ENV === 'production', follow: true },
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      siteName: site.name,
      ...(site.heroUrl ? { images: [{ url: site.heroUrl, alt: site.name }] } : {}),
    },
  };
}

export function businessData(site: PublicStorefrontDto) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    name: site.name,
    legalName: site.legalName,
    url: primaryUrl(site.primaryHostname, '/'),
    ...(site.address
      ? { address: { '@type': 'PostalAddress', streetAddress: site.address, addressCountry: 'IN' } }
      : {}),
    ...(site.contactPhone ? { telephone: site.contactPhone } : {}),
    ...(site.logoUrl ? { logo: site.logoUrl } : {}),
    ...(site.socialUrls.length ? { sameAs: site.socialUrls } : {}),
  };
}

export function vehicleData(site: PublicStorefrontDto, car: StorefrontVehicleResponse) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: car.title,
    url: primaryUrl(site.primaryHostname, `/car/${encodeURIComponent(car.slug)}`),
    ...(car.description ? { description: car.description } : {}),
    ...(car.images.length ? { image: car.images.map((image) => image.url) } : {}),
    ...(car.year ? { vehicleModelDate: String(car.year) } : {}),
    ...(car.facts.make ? { brand: { '@type': 'Brand', name: car.facts.make } } : {}),
    ...(car.facts.kilometersDriven !== null
      ? {
          mileageFromOdometer: {
            '@type': 'QuantitativeValue',
            value: car.facts.kilometersDriven,
            unitCode: 'KMT',
          },
        }
      : {}),
    ...(car.facts.pricePaise !== null
      ? {
          offers: {
            '@type': 'Offer',
            price: (car.facts.pricePaise / 100).toFixed(2),
            priceCurrency: 'INR',
            availability:
              car.availability === 'AVAILABLE'
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            seller: { '@type': 'AutoDealer', name: site.name },
          },
        }
      : {}),
  };
}

export function serializeStructuredData(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
