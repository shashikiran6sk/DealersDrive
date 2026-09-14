import type { DealerCard } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { DirectoryCard } from '@/components/dealers/dealer-card';

const BASE: DealerCard = {
  slug: 'sri-lakshmi-motors',
  brandName: 'Sri Lakshmi Motors',
  initials: 'SL',
  city: 'Vellore',
  state: 'Tamil Nadu',
  yearsOperating: 17,
  yearsLabel: 'Vellore, Tamil Nadu · 17 years',
  tagline: 'Hatchbacks under ₹6 lakh, every one inspected in-house',
  services: ['Hatchbacks', 'RC transfer', 'Exchange'],
  carCount: 7,
  fromPricePaise: 22_500_00,
  fromPriceLabel: 'from ₹2.25 Lakh',
  isVerified: true,
  logoUrl: null,
  coverUrl: null,
};

const meta = {
  title: 'Dealers/DirectoryCard',
  component: DirectoryCard,
  parameters: { layout: 'centered', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ width: 300 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DirectoryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { dealer: BASE } };

export const NoLiveCars: Story = {
  args: { dealer: { ...BASE, carCount: 0, fromPricePaise: null, fromPriceLabel: '—' } },
};

export const OneCar: Story = {
  args: {
    dealer: { ...BASE, carCount: 1, fromPricePaise: 4_20_000, fromPriceLabel: 'from ₹4.2 Lakh' },
  },
};

export const Sparse: Story = {
  args: {
    dealer: {
      ...BASE,
      tagline: null,
      services: [],
      carCount: 0,
      fromPricePaise: null,
      fromPriceLabel: '—',
    },
  },
};

export const NoTagline: Story = { args: { dealer: { ...BASE, tagline: null } } };

export const LongTagline: Story = {
  args: {
    dealer: {
      ...BASE,
      tagline:
        'Family-run since 1998 on Katpadi Main Road, buying directly from single-owner ' +
        'customers across the Vellore belt, every car through a 120-point check in our own ' +
        'workshop, with the full service history in hand.',
    },
  },
};

export const ManyServices: Story = {
  args: {
    dealer: {
      ...BASE,
      services: ['Hatchbacks', 'SUVs', 'Sedans', 'RC transfer', 'Finance'],
    },
  },
};

export const ServiceChips: Story = {
  args: { dealer: BASE },
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    () => (
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(3, 300px)' }}>
        <DirectoryCard dealer={{ ...BASE, slug: 'one', services: ['Hatchbacks'] }} />
        <DirectoryCard dealer={{ ...BASE, slug: 'two', services: ['Hatchbacks', 'RC transfer'] }} />
        <DirectoryCard
          dealer={{
            ...BASE,
            slug: 'three',
            services: ['In-house workshop', 'RC transfer assistance', 'Bank loan tie-ups'],
          }}
        />
      </div>
    ),
  ],
};

export const LongBrandName: Story = {
  args: {
    dealer: {
      ...BASE,
      brandName: 'Sri Venkateswara Automobiles and Finance Private Limited',
      initials: 'SV',
      yearsLabel: 'Tiruvannamalai, Tamil Nadu · 3 years',
    },
  },
};

export const ShortAndLongName: Story = {
  args: { dealer: BASE },
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    () => (
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '300px 300px' }}>
        <DirectoryCard
          dealer={{
            ...BASE,
            slug: 'chennai-cars',
            brandName: 'Chennai cars',
            initials: 'CC',
            yearsLabel: 'Vellore, Tamil Nadu · 1 year',
          }}
        />
        <DirectoryCard
          dealer={{
            ...BASE,
            slug: 'gowtham-cars',
            brandName: 'GOWTHAM CARS AND AUTOMOBILES',
            initials: 'GC',
            yearsLabel: 'Chittoor, Andhra Pradesh · 1 year',
          }}
        />
      </div>
    ),
  ],
};

export const Unverified: Story = { args: { dealer: { ...BASE, isVerified: false } } };

export const WithCover: Story = {
  args: {
    dealer: {
      ...BASE,
      coverUrl:
        'data:image/svg+xml;utf8,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="104">' +
            '<rect width="300" height="104" fill="%231e3fae"/>' +
            '<text x="150" y="58" font-family="sans-serif" font-size="13" fill="white" text-anchor="middle">yard photograph</text>' +
            '</svg>',
        ),
    },
  },
};

export const InTheGrid: Story = {
  args: { dealer: BASE },
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    () => (
      <div
        style={{
          display: 'grid',
          gap: 18,
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gridAutoRows: '1fr',
          width: 960,
        }}
      >
        {GRID.map((dealer) => (
          <DirectoryCard key={dealer.slug} dealer={dealer} />
        ))}
      </div>
    ),
  ],
};

const GRID: DealerCard[] = [
  BASE,
  {
    ...BASE,
    slug: 'annamalai-auto-mart',
    brandName: 'Annamalai Auto Mart',
    initials: 'AA',
    tagline: 'Sedans and SUVs, finance arranged in-house, exchange welcome',
    services: ['Sedans', 'Finance', 'Exchange'],
    carCount: 12,
    fromPriceLabel: 'from ₹3.4 Lakh',
    yearsLabel: 'Ranipet, Tamil Nadu · 9 years',
  },
  {
    ...BASE,
    slug: 'sri-venkateswara',
    brandName: 'Sri Venkateswara Automobiles and Finance Private Limited',
    initials: 'SV',
    tagline:
      'Family-run since 1998 on Katpadi Main Road, buying directly from single-owner ' +
      'customers across the Vellore belt, every car through a 120-point check in our own ' +
      'workshop, with the full service history in hand.',
    carCount: 1,
    fromPriceLabel: 'from ₹4.2 Lakh',
    yearsLabel: 'Tiruvannamalai, Tamil Nadu · 3 years',
  },
  {
    ...BASE,
    slug: 'velavan-cars',
    brandName: 'Velavan Cars',
    initials: 'VC',
    tagline: null,
    services: ['SUVs'],
    carCount: 0,
    fromPricePaise: null,
    fromPriceLabel: '—',
    yearsLabel: 'Katpadi, Tamil Nadu · 4 years',
  },
  {
    ...BASE,
    slug: 'kumaran-motors',
    brandName: 'Kumaran Motors',
    initials: 'KM',
    tagline: null,
    services: [],
    carCount: 0,
    fromPricePaise: null,
    fromPriceLabel: '—',
    yearsLabel: 'Arakkonam, Tamil Nadu · 1 year',
  },
  {
    ...BASE,
    slug: 'gandhi-nagar-cars',
    brandName: 'Gandhi Nagar Cars',
    initials: 'GN',
    tagline: null,
    services: ['RC transfer'],
    carCount: 2,
    fromPriceLabel: 'from ₹5.1 Lakh',
    yearsLabel: 'Walajapet, Tamil Nadu · 2 years',
  },
];

export const Fullest: Story = {
  args: {
    dealer: {
      ...BASE,
      brandName: 'Sri Venkateswara Automobiles and Finance Private Limited',
      initials: 'SV',
      yearsLabel: 'Tiruvannamalai, Tamil Nadu · 3 years',
      tagline:
        'Family-run since 1998 on Katpadi Main Road, buying directly from single-owner ' +
        'customers across the whole of the Vellore belt, every car checked in our own workshop.',
      services: ['In-house workshop', 'RC transfer assistance', 'Bank loan tie-ups'],
    },
  },
};

export const SameDataTwice: Story = {
  args: { dealer: BASE },
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, width: 960 }}>
        <MeasuredGrid label="Nothing optional filled in" dealers={SPARSE_ROW} />
        <MeasuredGrid label="Taglines and three services each" dealers={FULL_ROW} />
      </div>
    ),
  ],
};

const SPARSE_ROW: DealerCard[] = [
  {
    ...BASE,
    slug: 'arcot-cars',
    brandName: 'Arcot cars',
    initials: 'AC',
    tagline: null,
    services: [],
    carCount: 0,
    fromPricePaise: null,
    fromPriceLabel: '—',
    yearsLabel: 'Arcot, Tamil Nadu · 1 year',
  },
  {
    ...BASE,
    slug: 'chennai-cars',
    brandName: 'Chennai cars',
    initials: 'CC',
    tagline: null,
    services: [],
    carCount: 0,
    fromPricePaise: null,
    fromPriceLabel: '—',
    yearsLabel: 'Vellore, Tamil Nadu · 1 year',
  },
  {
    ...BASE,
    slug: 'sakthi-cars',
    brandName: 'Sakthi cars',
    initials: 'SC',
    tagline: null,
    services: [],
    carCount: 0,
    fromPricePaise: null,
    fromPriceLabel: '—',
    yearsLabel: 'Velachery, Tamilnadu · 1 year',
  },
];

const FULL_ROW: DealerCard[] = [
  {
    ...SPARSE_ROW[0]!,
    tagline: 'Hatchbacks under ₹6 lakh, every one inspected in-house before it is listed',
    services: ['In-house workshop', 'RC transfer assistance', 'Bank loan tie-ups'],
  },
  {
    ...SPARSE_ROW[1]!,
    tagline:
      'Family-run since 2014 — single-owner cars with full service history. Family-run since 2014.',
    services: ['In-house workshop', 'RC transfer assistance', 'Bank loan tie-ups'],
  },
  {
    ...SPARSE_ROW[2]!,
    tagline: 'Mass cars',
    services: ['insurance', 'return policy'],
  },
];

function MeasuredGrid({ label, dealers }: { label: string; dealers: DealerCard[] }) {
  const [height, setHeight] = useState<number | null>(null);

  return (
    <div>
      <div style={{ fontSize: 12, marginBottom: 8, opacity: 0.7 }}>
        {label} — card height:{' '}
        <strong data-testid="card-height">{height === null ? '…' : `${String(height)}px`}</strong>
      </div>
      <div
        ref={(node) => {
          const card = node?.querySelector('article');
          if (card) setHeight(Math.round(card.getBoundingClientRect().height));
        }}
        style={{
          display: 'grid',
          gap: 18,
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
        }}
      >
        {dealers.map((dealer) => (
          <DirectoryCard key={dealer.slug} dealer={dealer} />
        ))}
      </div>
    </div>
  );
}
