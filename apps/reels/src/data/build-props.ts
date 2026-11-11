import type { DealerPublicProfile, VehicleCardDto } from '@dealers-drive/contracts';

import { pricesAsOf } from '../copy/copy';
import { MAX_FEATURED_CARS, MAX_GALLERY_TILES, MAX_SERVICES } from '../reel/reel.constants';
import type { ReelCar, ReelProps, ReelSound } from '../reel/reel.types';

import { withCampaign } from './campaign';
import { dealerLocation, dealerServices } from './dealer';
import { pickFeatured, priceRange, selectFeatured, selectGallery, showcaseCars } from './featured';
import { modelKey, type ModelName } from './models';
import { carSpecs, titleWithoutYear } from './specs';
import { stockFigure } from './stock';

export type BuildReelInput = {
  profile: DealerPublicProfile;
  cards: readonly VehicleCardDto[];
  available: number;
  asOf: Date;
  sound: ReelSound;
  imageSrc: (url: string) => string;
  models?: readonly ModelName[];
  featureTerms?: readonly string[];
};

export function cardImage(card: VehicleCardDto, imageSrc: (url: string) => string): string | null {
  return card.image === null ? null : imageSrc(card.image.url);
}

function toReelCar(card: VehicleCardDto, imageSrc: (url: string) => string): ReelCar {
  return {
    slug: card.slug,
    title: titleWithoutYear(card.title, card.year),
    year: card.year,
    price: card.priceLabel,
    specs: carSpecs(card.metaLabel),
    imageSrc: cardImage(card, imageSrc),
  };
}

export function hasShowcase(cards: readonly VehicleCardDto[]): boolean {
  return showcaseCars(cards).length > 0;
}

export function buildReelProps(input: BuildReelInput): ReelProps {
  const {
    profile,
    cards,
    available,
    asOf,
    sound,
    imageSrc,
    models = [],
    featureTerms = [],
  } = input;
  const showcase = showcaseCars(cards);
  const featured =
    featureTerms.length > 0
      ? pickFeatured(showcase, featureTerms, MAX_FEATURED_CARS)
      : selectFeatured(showcase, MAX_FEATURED_CARS, (card) =>
          modelKey(titleWithoutYear(card.title, card.year), models),
        );
  const gallery = selectGallery(showcase, featured, MAX_GALLERY_TILES).flatMap((card) => {
    const src = cardImage(card, imageSrc);
    return src === null ? [] : [src];
  });

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
    stock: stockFigure(available),
    priceRange: priceRange(showcase),
    pageUrl: withCampaign(profile.seo.canonical),
    asOf: pricesAsOf(asOf),
    sound,
  };
}
