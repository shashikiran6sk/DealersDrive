import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { HeroKeys } from '@/features/home/hero-keys';

const meta = {
  title: 'Home/HeroKeys',
  component: HeroKeys,
  parameters: { layout: 'padded' },
  argTypes: { className: { control: 'text' } },
} satisfies Meta<typeof HeroKeys>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PhoneWidth: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
