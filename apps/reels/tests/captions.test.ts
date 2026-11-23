import { describe, expect, it } from 'vitest';

import {
  brandTags,
  buildCaptions,
  carLine,
  hashtag,
  lowestPrice,
  stockText,
  tagLine,
  youtubeFile,
  youtubeTitle,
} from '../src/captions/captions';
import type { ReelCar, ReelProps } from '../src/reel/reel.types';
import { SAMPLE_PROPS } from '../src/reel/sample-props';

const CAR: ReelCar = {
  slug: 'x',
  title: 'Maruti Suzuki Baleno Zeta',
  year: 2021,
  price: '₹7,00,000',
  specs: [],
  imageSrc: null,
};

function props(overrides: Partial<ReelProps> = {}): ReelProps {
  return {
    ...SAMPLE_PROPS,
    pageUrl: 'https://www.dealers-drive.com/dealers/sample?utm_source=dealer-reel',
    stock: { value: 15, plus: true },
    ...overrides,
  };
}

const INPUT = { city: 'Vellore', state: 'Tamil Nadu' };

describe('helpers', () => {
  it('builds hashtags from free text', () => {
    expect(hashtag('tamil nadu')).toBe('TamilNadu');
    expect(hashtag('I10 Nios-Magna!')).toBe('I10NiosMagna');
  });

  it('writes the stock figure with its plus', () => {
    expect(stockText({ value: 15, plus: true })).toBe('15+');
    expect(stockText({ value: 8, plus: false })).toBe('8');
  });

  it('lists a car with its year and price, or price on request', () => {
    expect(carLine(CAR)).toBe('• 2021 Maruti Suzuki Baleno Zeta · ₹7,00,000');
    expect(carLine({ ...CAR, year: null, price: null })).toBe(
      '• Maruti Suzuki Baleno Zeta · Price on request',
    );
  });

  it('takes distinct brands from the featured titles', () => {
    const cars = ['Tata Nexon', 'Tata Tigor', 'Kia Seltos', 'Ford Freestyle', 'Toyota Innova'].map(
      (title) => ({ ...CAR, title }),
    );
    expect(brandTags(cars, 3)).toEqual(['Tata', 'Kia', 'Ford']);
  });

  it('joins tags once each and skips empty ones', () => {
    expect(tagLine(['UsedCars', '', 'UsedCars', 'Vellore'])).toBe('#UsedCars #Vellore');
  });

  it('reads the lowest price off the range', () => {
    expect(lowestPrice('₹3.75 Lakh – ₹26.00 Lakh')).toBe('₹3.75 Lakh');
    expect(lowestPrice(null)).toBeNull();
  });
});

describe('youtubeTitle', () => {
  it('leads with the stock, town and starting price', () => {
    expect(
      youtubeTitle({ props: props({ priceRange: '₹3.75 Lakh – ₹26.00 Lakh' }), ...INPUT }),
    ).toBe('15+ Used Cars in Vellore from ₹3.75 Lakh | Sample Motors #Shorts');
  });

  it('drops the price when there is none and says car for one', () => {
    const one = props({ priceRange: null, stock: { value: 1, plus: false } });
    expect(youtubeTitle({ props: one, ...INPUT })).toBe(
      '1 Used Car in Vellore | Sample Motors #Shorts',
    );
  });

  it('stays within YouTube’s 100 characters', () => {
    const long = { ...SAMPLE_PROPS.dealer, name: 'Sri Venkateswara Premium Pre-Owned Cars' };
    const longer = { ...SAMPLE_PROPS.dealer, name: 'X'.repeat(140) };
    const medium = youtubeTitle({
      props: props({ dealer: long }),
      city: 'Thiruvannamalai Town Centre',
      state: 'TN',
    });
    expect(medium.length).toBeLessThanOrEqual(100);
    expect(medium).toContain('#Shorts');
    const capped = youtubeTitle({ props: props({ dealer: longer }), ...INPUT });
    expect(capped.length).toBeLessThanOrEqual(100);
    expect(capped.endsWith('… #Shorts')).toBe(true);
  });
});

describe('buildCaptions', () => {
  const captions = buildCaptions({ props: props(), ...INPUT });

  it('writes an Instagram caption with the cars, Tamil, date and tags, and no link or phone', () => {
    expect(captions.instagram).toContain('Sample Motors, Vellore, Tamil Nadu · 15+ pre-owned cars');
    expect(captions.instagram).toContain('• 2021 Maruti Suzuki Swift VXI · ₹5,40,000');
    expect(captions.instagram).toContain(
      'Services offered: Exchange · Loan · RC Transfer · Insurance',
    );
    expect(captions.instagram).toContain('வேலூர், தமிழ்நாடு: 15+ பயன்படுத்திய கார்கள் விற்பனைக்கு');
    expect(captions.instagram).toContain('Prices as of 4 Nov 2026. Prices may change.');
    expect(captions.instagram).toContain(
      '#DealersDrive #UsedCars #PreOwnedCars #UsedCarsVellore #Vellore #TamilNadu',
    );
    expect(captions.instagram).toContain(
      'See every car: tap the link in our bio, go to Dealers, and search "Sample Motors". Or scan the QR code in the reel.',
    );
    expect(captions.instagram).not.toContain('http');
    expect(captions.instagram.length).toBeLessThan(2200);
  });

  it('writes a YouTube description with a link tagged for YouTube', () => {
    expect(captions.youtube.description).toContain('utm_source=youtube');
    expect(captions.youtube.description).toContain('Featured in this Short:');
    expect(captions.youtube.description.split('\n').at(-1)).toMatch(
      /^#Shorts #UsedCars #DealersDrive #Vellore/,
    );
    expect(youtubeFile(captions).startsWith(`${captions.youtube.title}\n\n`)).toBe(true);
  });

  it('leaves out the price range and services when there are none', () => {
    const bare = buildCaptions({
      props: props({
        priceRange: null,
        dealer: {
          ...SAMPLE_PROPS.dealer,
          services: [],
          location: { en: 'Pernambut, Tamil Nadu', ta: null },
        },
      }),
      ...INPUT,
    });
    expect(bare.instagram).not.toContain('Price range');
    expect(bare.instagram).not.toContain('Services offered');
    expect(bare.instagram).toContain('Sample Motors, Pernambut, Tamil Nadu: 15+');
  });
});
