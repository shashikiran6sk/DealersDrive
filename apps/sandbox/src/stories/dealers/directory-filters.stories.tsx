import type { PublicLocations } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DirectoryFilters } from '@/components/dealers/directory-filters';

const LOCATIONS: PublicLocations = {
  districts: [
    { slug: 'vellore', name: 'Vellore', count: 11, state: 'Tamil Nadu' },
    { slug: 'ranipet', name: 'Ranipet', count: 11, state: 'Tamil Nadu' },
    { slug: 'tirupattur', name: 'Tirupattur', count: 8, state: 'Tamil Nadu' },
    { slug: 'mysuru', name: 'Mysuru', count: 11, state: 'Karnataka' },
    { slug: 'bengaluru-urban', name: 'Bengaluru Urban', count: 11, state: 'Karnataka' },
    { slug: 'ernakulam', name: 'Ernakulam', count: 11, state: 'Kerala' },
    { slug: 'kozhikode', name: 'Kozhikode', count: 8, state: 'Kerala' },
  ],
  total: 120,
};

const CITIES = [
  { slug: 'vellore', name: 'Vellore', count: 12 },
  { slug: 'katpadi', name: 'Katpadi', count: 7 },
  { slug: 'gudiyatham', name: 'Gudiyatham', count: 2 },
  { slug: 'arakkonam', name: 'Arakkonam', count: 1 },
];

const meta = {
  title: 'Dealers/DirectoryFilters',
  component: DirectoryFilters,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ width: 900 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DirectoryFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { cities: CITIES, locations: LOCATIONS } };

export const AppliedTownWithoutADistrict: Story = {
  args: { cities: CITIES, city: ['vellore'], locations: LOCATIONS },
};

export const OneTown: Story = {
  args: { cities: CITIES, city: ['vellore'], district: 'vellore', locations: LOCATIONS },
};

export const SeveralTowns: Story = {
  args: {
    cities: CITIES,
    city: ['vellore', 'katpadi'],
    district: 'vellore',
    locations: LOCATIONS,
  },
};

export const Searching: Story = {
  args: { cities: CITIES, q: 'lakshmi', district: 'vellore', locations: LOCATIONS },
};

export const SearchWithinACity: Story = {
  args: {
    cities: CITIES,
    city: ['vellore'],
    q: 'lakshmi',
    district: 'vellore',
    locations: LOCATIONS,
  },
};

export const WithinADistrict: Story = {
  args: {
    cities: CITIES.slice(0, 3),
    district: 'vellore',
    city: ['katpadi'],
    locations: LOCATIONS,
  },
};

export const OneCity: Story = {
  args: { cities: CITIES.slice(0, 1), district: 'vellore', locations: LOCATIONS },
};

export const NoCities: Story = {
  args: { cities: [], district: 'vellore', locations: LOCATIONS },
};

export const ManyCities: Story = {
  args: {
    district: 'vellore',
    locations: LOCATIONS,
    cities: [
      ...CITIES,
      { slug: 'ranipet', name: 'Ranipet', count: 6 },
      { slug: 'ambur', name: 'Ambur', count: 5 },
      { slug: 'vaniyambadi', name: 'Vaniyambadi', count: 4 },
      { slug: 'tiruvannamalai', name: 'Tiruvannamalai', count: 4 },
      { slug: 'kanchipuram', name: 'Kanchipuram', count: 3 },
      { slug: 'chengalpattu', name: 'Chengalpattu', count: 3 },
      { slug: 'thiruvallur', name: 'Thiruvallur', count: 2 },
      { slug: 'sriperumbudur', name: 'Sriperumbudur', count: 1 },
    ],
  },
};
