import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { BrandLogo } from '@/components/brand-logo';
import { Plate } from '@/components/ui/primitives';

const meta = {
  title: 'Primitives/Plate',
  component: Plate,
  parameters: { layout: 'centered' },
  argTypes: {
    size: { control: 'inline-radio', options: ['year', 'logo', 'chip', 'marker'] },
    children: { control: 'text' },
  },
  args: { children: '2019', size: 'year' },
} satisfies Meta<typeof Plate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const EverySize: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <Plate size="year">2019</Plate>
      <BrandLogo />
      <Plate size="chip">VERIFIED</Plate>
      <Plate size="marker">PRIMARY</Plate>
    </div>
  ),
};

export const LongLabel: Story = { args: { children: 'TN 09 BX 1234', size: 'logo' } };
