import type { PublicLocations } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DistrictPicker } from '@/components/layout/district-picker';

const FOUR_STATES: PublicLocations = {
  districts: [
    { slug: 'vellore', name: 'Vellore', count: 11, state: 'Tamil Nadu' },
    { slug: 'ranipet', name: 'Ranipet', count: 11, state: 'Tamil Nadu' },
    { slug: 'tirupattur', name: 'Tirupattur', count: 8, state: 'Tamil Nadu' },
    { slug: 'bengaluru-urban', name: 'Bengaluru Urban', count: 11, state: 'Karnataka' },
    { slug: 'mysuru', name: 'Mysuru', count: 11, state: 'Karnataka' },
    { slug: 'belagavi', name: 'Belagavi', count: 8, state: 'Karnataka' },
    { slug: 'visakhapatnam', name: 'Visakhapatnam', count: 11, state: 'Andhra Pradesh' },
    { slug: 'guntur', name: 'Guntur', count: 11, state: 'Andhra Pradesh' },
    { slug: 'kurnool', name: 'Kurnool', count: 8, state: 'Andhra Pradesh' },
    { slug: 'ernakulam', name: 'Ernakulam', count: 11, state: 'Kerala' },
    { slug: 'thrissur', name: 'Thrissur', count: 11, state: 'Kerala' },
    { slug: 'kozhikode', name: 'Kozhikode', count: 8, state: 'Kerala' },
  ],
  total: 120,
};

const meta = {
  title: 'Layout/DistrictPicker',
  component: DistrictPicker,
  parameters: { layout: 'centered', nextjs: { appDirectory: true } },
  args: { locations: FOUR_STATES },
} satisfies Meta<typeof DistrictPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HeaderTrigger: Story = {
  args: {
    children: (chosen) => (
      <button type="button" className="btn btn-secondary flex items-center gap-[7px]">
        <span className="block h-[14px] w-[5px] bg-(--color-accent)" aria-hidden="true" />
        {chosen?.name ?? 'Select district'} <span aria-hidden="true">▾</span>
      </button>
    ),
  },
};

export const DirectoryTrigger: Story = {
  args: {
    children: () => (
      <button type="button" className="btn btn-secondary flex items-center gap-[7px]">
        <span className="block h-[14px] w-[5px] bg-(--color-accent)" aria-hidden="true" />
        Select district
      </button>
    ),
  },
};

export const OneChosen: Story = {
  args: HeaderTrigger.args,
  parameters: {
    layout: 'centered',
    nextjs: { appDirectory: true, navigation: { query: { district: 'kozhikode' } } },
  },
};

export const NoDistricts: Story = {
  args: { ...HeaderTrigger.args, locations: { districts: [], total: 0 } },
};
