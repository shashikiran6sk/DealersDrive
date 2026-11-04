import { pricesAsOf } from '../copy/copy';

import type { ReelProps } from './reel.types';

export const SAMPLE_PROPS: ReelProps = {
  dealer: {
    name: 'Sample Motors',
    initials: 'SM',
    isVerified: true,
    logoSrc: null,
    location: { en: 'Vellore, Tamil Nadu', ta: 'வேலூர், தமிழ்நாடு' },
    services: [
      { en: 'Exchange', ta: 'எக்ஸ்சேஞ்ச்' },
      { en: 'Loan', ta: 'கடன் வசதி' },
      { en: 'RC Transfer', ta: 'RC மாற்றம்' },
      { en: 'Insurance', ta: 'காப்பீடு' },
    ],
  },
  featured: [
    {
      slug: 'sample-hatchback',
      title: 'Maruti Suzuki Swift VXI',
      year: 2021,
      price: '₹5,40,000',
      specs: [
        { en: '41,725 km', ta: '41,725 கி.மீ' },
        { en: 'Petrol', ta: 'பெட்ரோல்' },
        { en: 'Manual', ta: 'மேனுவல்' },
      ],
      imageSrc: null,
    },
    {
      slug: 'sample-suv',
      title: 'Hyundai Creta SX',
      year: 2022,
      price: '₹12,75,000',
      specs: [
        { en: '32,392 km', ta: '32,392 கி.மீ' },
        { en: 'Diesel', ta: 'டீசல்' },
        { en: 'Automatic', ta: 'ஆட்டோமேட்டிக்' },
      ],
      imageSrc: null,
    },
  ],
  gallery: [],
  availableCount: 12,
  priceRange: '₹3.50 Lakh – ₹12.75 Lakh',
  pageUrl: 'https://www.dealers-drive.com/dealers',
  asOf: pricesAsOf(new Date(Date.UTC(2026, 10, 4))),
  sound: { music: null, whoosh: null },
};
