import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PUBLIC_PORTFOLIO } from '../../mocks/portfolio';

import { DealerGallery } from '@/components/dealers/dealer-gallery';

const meta = {
  title: 'Dealers/DealerGallery',
  component: DealerGallery,
  args: { brandName: 'Sri Lakshmi Motors', photos: PUBLIC_PORTFOLIO },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DealerGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Photos: Story = {};

export const OnePhoto: Story = { args: { photos: PUBLIC_PORTFOLIO.slice(0, 1) } };

export const WithoutCaptions: Story = {
  args: { photos: PUBLIC_PORTFOLIO.map((photo) => ({ ...photo, caption: null })) },
};

export const Empty: Story = { args: { photos: [] } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
