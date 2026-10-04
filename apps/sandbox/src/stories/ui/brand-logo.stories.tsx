import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { BrandLogo } from '@/components/brand-logo';

const meta = {
  title: 'Primitives/BrandLogo',
  component: BrandLogo,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['light', 'dark'] },
    size: { control: { type: 'number', min: 16, max: 256 } },
  },
  args: { variant: 'light', size: 30 },
} satisfies Meta<typeof BrandLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Dark: Story = {
  args: { variant: 'dark' },
  decorators: [
    (Story) => (
      <div className="rounded-lg bg-black p-6">
        <Story />
      </div>
    ),
  ],
};
export const Surfaces: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      {['#ffffff', '#fbfbfa', '#f7f7f5', '#0c0c0b', '#000000'].map((background, index) => (
        <div key={background} style={{ background, padding: 24 }}>
          <BrandLogo variant={index < 3 ? 'light' : 'dark'} size={96} />
        </div>
      ))}
    </div>
  ),
};
