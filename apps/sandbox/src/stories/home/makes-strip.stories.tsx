import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { MakesStrip } from '@/features/home/makes-strip';

const MAKES = [
  'Maruti Suzuki',
  'Hyundai',
  'Nissan',
  'Skoda',
  'Renault',
  'Honda',
  'Volkswagen',
  'Tata',
].map((label) => ({ label, href: `/cars?brand=${label.toLowerCase().replace(' ', '-')}` }));

const meta = {
  title: 'Home/MakesStrip',
  component: MakesStrip,
  parameters: { layout: 'fullscreen' },
  args: { makes: MAKES },
} satisfies Meta<typeof MakesStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EightMakes: Story = {};

export const FewerThanThreeRendersNothing: Story = { args: { makes: MAKES.slice(0, 2) } };

export const PhoneWidth: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
