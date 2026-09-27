import type { PublicLocations } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DistrictScope } from '@/components/search/district-scope';

const LOCATIONS: PublicLocations = {
  districts: [
    { slug: 'vellore', name: 'Vellore', count: 11, state: 'Tamil Nadu' },
    { slug: 'ranipet', name: 'Ranipet', count: 11, state: 'Tamil Nadu' },
    { slug: 'tirupattur', name: 'Tirupattur', count: 8, state: 'Tamil Nadu' },
    { slug: 'mysuru', name: 'Mysuru', count: 11, state: 'Karnataka' },
  ],
  total: 41,
  cars: { total: 128, districts: { vellore: 42, ranipet: 38, tirupattur: 21, mysuru: 27 } },
};

const meta = {
  title: 'Search/DistrictScope',
  component: DistrictScope,
  parameters: {
    layout: 'padded',
    nextjs: { appDirectory: true, navigation: { pathname: '/cars' } },
  },
  args: { locations: LOCATIONS },
} satisfies Meta<typeof DistrictScope>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EveryDistrict: Story = {};

export const OneChosen: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/cars', query: { district: 'ranipet' } },
    },
  },
};

export const NoDistricts: Story = {
  args: { locations: { districts: [], total: 0, cars: { total: 0, districts: {} } } },
};
