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
    expect(props.availableCount).toBe(5);
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
