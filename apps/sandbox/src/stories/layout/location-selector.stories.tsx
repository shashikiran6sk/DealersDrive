import type { PublicLocations } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LocationSelector } from '@/components/layout/location-selector';

const TAMIL_NADU: PublicLocations['districts'] = [
  { slug: 'chennai', name: 'Chennai', count: 48, state: 'Tamil Nadu' },
  { slug: 'coimbatore', name: 'Coimbatore', count: 31, state: 'Tamil Nadu' },
  { slug: 'madurai', name: 'Madurai', count: 22, state: 'Tamil Nadu' },
  { slug: 'tiruchirappalli', name: 'Tiruchirappalli', count: 18, state: 'Tamil Nadu' },
  { slug: 'salem', name: 'Salem', count: 16, state: 'Tamil Nadu' },
  { slug: 'vellore', name: 'Vellore', count: 11, state: 'Tamil Nadu' },
  { slug: 'ranipet', name: 'Ranipet', count: 11, state: 'Tamil Nadu' },
  { slug: 'erode', name: 'Erode', count: 10, state: 'Tamil Nadu' },
  { slug: 'tirupattur', name: 'Tirupattur', count: 8, state: 'Tamil Nadu' },
  { slug: 'thanjavur', name: 'Thanjavur', count: 8, state: 'Tamil Nadu' },
  { slug: 'kanchipuram', name: 'Kanchipuram', count: 7, state: 'Tamil Nadu' },
  { slug: 'chengalpattu', name: 'Chengalpattu', count: 6, state: 'Tamil Nadu' },
  { slug: 'tirunelveli', name: 'Tirunelveli', count: 4, state: 'Tamil Nadu' },
  { slug: 'thoothukudi', name: 'Thoothukudi', count: 2, state: 'Tamil Nadu' },
];

const ONE_STATE: PublicLocations = {
  districts: [
    { slug: 'vellore', name: 'Vellore', count: 11, state: 'Tamil Nadu' },
    { slug: 'ranipet', name: 'Ranipet', count: 11, state: 'Tamil Nadu' },
    { slug: 'tirupattur', name: 'Tirupattur', count: 8, state: 'Tamil Nadu' },
  ],
  total: 30,
};

const meta = {
  title: 'Layout/LocationSelector',
  component: LocationSelector,
  parameters: { layout: 'centered', nextjs: { appDirectory: true } },
  args: { locations: ONE_STATE },
} satisfies Meta<typeof LocationSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Chosen: Story = {
  parameters: {
    layout: 'centered',
    nextjs: { appDirectory: true, navigation: { query: { district: 'vellore' } } },
  },
};

export const ManyStates: Story = {
  args: {
    locations: {
      total: 268,
      districts: [
        ...TAMIL_NADU,
        { slug: 'bengaluru-urban', name: 'Bengaluru Urban', count: 27, state: 'Karnataka' },
        { slug: 'mysuru', name: 'Mysuru', count: 9, state: 'Karnataka' },
        { slug: 'dharwad', name: 'Dharwad', count: 5, state: 'Karnataka' },
        { slug: 'ernakulam', name: 'Ernakulam', count: 14, state: 'Kerala' },
        { slug: 'thrissur', name: 'Thrissur', count: 6, state: 'Kerala' },
        { slug: 'hyderabad', name: 'Hyderabad', count: 21, state: 'Telangana' },
        { slug: 'rangareddy', name: 'Rangareddy', count: 4, state: 'Telangana' },
      ],
    },
  },
};

export const ManyDistricts: Story = {
  args: { locations: { total: 212, districts: TAMIL_NADU } },
};

export const Untidy: Story = {
  args: {
    locations: {
      total: 40,
      districts: [
        { slug: 'vellore', name: 'Vellore', count: 11, state: 'Tamil Nadu' },
        { slug: 'ranipet', name: 'Ranipet', count: 9, state: 'Tamil Nadu' },
        { slug: 'north-goa', name: 'North Goa', count: 6, state: 'Goaa' },
        { slug: 'somewhere', name: 'Somewhere', count: 8, state: null },
        { slug: 'elsewhere', name: 'Elsewhere', count: 6, state: null },
      ],
    },
  },
};

export const NoDistricts: Story = { args: { locations: { districts: [], total: 0 } } };
