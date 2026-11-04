import type { DealerPublicProfile, VehicleCardDto } from '@dealers-drive/contracts';

import { pricesAsOf } from '../copy/copy';
import { MAX_FEATURED_CARS, MAX_GALLERY_TILES, MAX_SERVICES } from '../reel/reel.constants';
import type { ReelCar, ReelProps } from '../reel/reel.types';

import { withCampaign } from './campaign';
import { dealerLocation, dealerServices } from './dealer';
import { priceRange, selectFeatured, selectGallery, showcaseCars } from './featured';
import { carSpecs, titleWithoutYear } from './specs';

export type BuildReelInput = {
  profile: DealerPublicProfile;
  cards: readonly VehicleCardDto[];
  available: number;
  asOf: Date;
  musicSrc: string | null;
  imageSrc: (url: string) => string;
};

function toReelCar(card: VehicleCardDto, imageSrc: (url: string) => string): ReelCar {
  return {
    slug: card.slug,
    title: titleWithoutYear(card.title, card.year),
    year: card.year,
    price: card.priceLabel,
    specs: carSpecs(card.metaLabel),
    imageSrc: card.image === null ? null : imageSrc(card.image.url),
  };
}

export function hasShowcase(cards: readonly VehicleCardDto[]): boolean {
  return showcaseCars(cards).length > 0;
}

export function buildReelProps(input: BuildReelInput): ReelProps {
  const { profile, cards, available, asOf, musicSrc, imageSrc } = input;
  const showcase = showcaseCars(cards);
  const featured = selectFeatured(showcase, MAX_FEATURED_CARS);
  const gallery = selectGallery(showcase, featured, MAX_GALLERY_TILES).flatMap((card) =>
    card.image === null ? [] : [imageSrc(card.image.url)],
  );

  return {
    dealer: {
      name: profile.brandName,
      initials: profile.initials,
      isVerified: profile.isVerified,
      logoSrc: profile.logoUrl === null ? null : imageSrc(profile.logoUrl),
      location: dealerLocation(profile.address.city, profile.address.state),
      services: dealerServices(profile.services, MAX_SERVICES),
    },
    featured: featured.map((card) => toReelCar(card, imageSrc)),
    gallery,
    availableCount: available,
    priceRange: priceRange(showcase),
    pageUrl: withCampaign(profile.seo.canonical),
    asOf: pricesAsOf(asOf),
    musicSrc,
  };
}
