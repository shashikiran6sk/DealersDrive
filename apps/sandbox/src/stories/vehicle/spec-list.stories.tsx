import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SpecList } from '@/components/vehicle/spec-list';

const meta = {
  title: 'Vehicle/SpecList',
  component: SpecList,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560, margin: '24px auto' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    specs: [
      { label: 'Make', value: 'Hyundai' },
      { label: 'Model', value: 'Creta' },
      { label: 'Variant', value: 'SX(O)' },
      { label: 'Manufacturing year', value: '2023' },
      { label: 'Registered at', value: 'TN 23' },
      { label: 'Fuel', value: 'Petrol' },
      { label: 'Transmission', value: 'Automatic' },
      { label: 'Kilometres driven', value: '22,400 km' },
      { label: 'Owners', value: '1st owner' },
      { label: 'Insurance valid until', value: '31 Mar 2027' },
    ],
  },
} satisfies Meta<typeof SpecList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sparse: Story = {
  args: {
    specs: [
      { label: 'Make', value: 'Maruti Suzuki' },
      { label: 'Model', value: 'Swift' },
    ],
  },
};
