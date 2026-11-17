import { describe, expect, it } from 'vitest';

import { buildReelProps, cardImage, hasShowcase } from '../src/data/build-props';
import { planMedia } from '../src/data/media';

import { card, profile } from './fixtures';

const AS_OF = new Date(Date.UTC(2026, 10, 4));

describe('buildReelProps', () => {
  it('turns a profile and its inventory into everything the reel draws', () => {
    const media = planMedia(1600);
    const cars = ['3', '9', '5', '26', '7'].map((lakh) =>
      card({ slug: `c${lakh}`, priceLabel: `₹${lakh},00,000` }),
    );
    const props = buildReelProps({
      profile: profile({ isVerified: true, logoUrl: 'https://cdn.example.com/logo.png' }),
      cards: [...cars, card({ slug: 'reserved', availability: 'RESERVED' })],
      available: 5,
      asOf: AS_OF,
      sound: { music: null, whoosh: null },
      imageSrc: media.src,
    });

    expect(props.dealer).toMatchObject({
      name: 'Sample Motors',
      isVerified: true,
      location: { en: 'Vellore, Tamil Nadu', ta: 'வேலூர், தமிழ்நாடு' },
    });
    expect(props.dealer.logoSrc).toMatch(/^media\/[0-9a-f]{24}\.png$/);
    expect(props.dealer.services.map((service) => service.en)).toEqual([
      'Buying',
      'Loan',
      'RC Transfer',
    ]);
    expect(props.featured.map((car) => car.slug)).toEqual(['c3', 'c5', 'c7', 'c9', 'c26']);
    expect(props.featured[0]).toMatchObject({ title: 'Tata Nexon XZA+ S', year: 2022 });
    expect(props.featured[0]?.imageSrc).toMatch(/^media\//);
    expect(props.gallery).toHaveLength(5);
    expect(props.stock).toEqual({ value: 5, plus: false });
    expect(props.priceRange).toBe('₹3.00 Lakh – ₹26.00 Lakh');
    expect(props.pageUrl).toContain('utm_source=dealer-reel');
    expect(props.asOf.en).toBe('Prices as of 4 Nov 2026');
    expect(media.files().size).toBe(6);
  });

  it('carries a missing logo and photo through as null', () => {
    const props = buildReelProps({
      profile: profile(),
      cards: [card({ slug: 'only' })],
      available: 1,
      asOf: AS_OF,
      sound: { music: 'audio/track.mp3', whoosh: 'audio/whoosh.wav' },
      imageSrc: (url) => url,
    });
    expect(props.dealer.logoSrc).toBeNull();
    expect(props.sound).toEqual({ music: 'audio/track.mp3', whoosh: 'audio/whoosh.wav' });
  });
});

describe('buildReelProps featured cars', () => {
  const base = {
    profile: profile(),
    available: 3,
    asOf: AS_OF,
    sound: { music: null, whoosh: null },
    imageSrc: (url: string) => url,
  };
  const cars = [
    card({
      slug: 'eeco-15',
      title: '2015 Maruti Suzuki Eeco',
      year: 2015,
      priceLabel: '₹3,75,000',
    }),
    card({
      slug: 'eeco-20',
      title: '2020 Maruti Suzuki Eeco',
      year: 2020,
      priceLabel: '₹5,15,000',
    }),
    card({ slug: 'creta', title: '2016 Hyundai Creta', year: 2016, priceLabel: '₹7,25,000' }),
  ];

  it('skips a repeated model using the brand models from the API', () => {
    const others = ['Alto', 'Baleno', 'Ciaz', 'Dzire', 'Ertiga', 'Fronx', 'Gypsy'].map(
      (model, index) =>
        card({
          slug: model.toLowerCase(),
          title: `2019 Maruti Suzuki ${model}`,
          year: 2019,
          priceLabel: `₹${index + 4},00,000`,
        }),
    );
    const props = buildReelProps({
      ...base,
      cards: [...cars.slice(0, 2), ...others],
      models: ['Eeco', 'Alto', 'Baleno', 'Ciaz', 'Dzire', 'Ertiga', 'Fronx', 'Gypsy'].map(
        (model) => ({ brand: 'Maruti Suzuki', model }),
      ),
    });
    const slugs = props.featured.map((car) => car.slug);
    expect(slugs).toHaveLength(8);
    expect(slugs).toContain('eeco-20');
    expect(slugs).not.toContain('eeco-15');
  });

  it('features exactly the hand-picked cars when named', () => {
    const props = buildReelProps({ ...base, cards: cars, featureTerms: ['creta', 'eeco'] });
    expect(props.featured.map((car) => car.slug)).toEqual(['eeco-15', 'creta']);
  });
});

describe('hasShowcase', () => {
  it('needs at least one available car with a photo', () => {
    expect(hasShowcase([card({ image: null })])).toBe(false);
    expect(hasShowcase([card()])).toBe(true);
  });
});

describe('cardImage', () => {
  it('maps a photo to its public path and a missing photo to null', () => {
    expect(cardImage(card({ image: null }), (url) => url)).toBeNull();
    expect(cardImage(card(), () => 'media/x.webp')).toBe('media/x.webp');
  });
});
