import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PriceBlock } from '@/components/vehicle/price-block';

const meta = {
  title: 'Vehicle/PriceBlock',
  component: PriceBlock,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, margin: '24px auto' }}>
        <Story />
      </div>
    ),
  ],
  args: { priceLabel: '₹14,50,000', negotiabilityLabel: 'Fixed price' },
} satisfies Meta<typeof PriceBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Negotiable: Story = { args: { negotiabilityLabel: 'Negotiable' } };

export const OnRequest: Story = { args: { priceLabel: null, negotiabilityLabel: null } };
