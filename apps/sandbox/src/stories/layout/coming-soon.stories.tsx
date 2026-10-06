import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ComingSoon } from '@/components/public/coming-soon';

const meta = {
  title: 'Layout/ComingSoon',
  component: ComingSoon,
  parameters: { layout: 'fullscreen' },
  args: {
    eyebrow: 'Marketplace',
    title: 'Coming soon',
    description: 'This experience is on its way.',
  },
} satisfies Meta<typeof ComingSoon>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {};
