import type { AdminVehicleImage, AdminVehicleImages } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ListingImages } from '@/features/admin/listing-images';

const LISTING_ID = '11111111-1111-4111-8111-111111111111';

const SHADES = ['1f2937', '374151', '4b5563', '0f172a', '1e293b', '334155', '475569', '111827'];

function image(position: number): AdminVehicleImage {
  const shade = SHADES[position % SHADES.length] ?? '1f2937';
  return {
    mediaId: `00000000-0000-4000-8000-${String(position).padStart(12, '0')}`,
    position,
    isPrimary: position === 0,
    url: `https://placehold.co/1200x900/${shade}/e5e7eb.png?text=Image+${position + 1}`,
    fileName: `creta-${position + 1}.jpg`,
    mimeType: 'image/jpeg',
    bytes: 1_200_000,
    width: 2400,
    height: 1800,
    uploadedAt: '2026-09-26T10:00:00.000Z',
  };
}

function images(count: number, overrides: Partial<AdminVehicleImages> = {}): AdminVehicleImages {
  return {
    items: Array.from({ length: count }, (_, position) => image(position)),
    min: 6,
    max: 20,
    canEdit: true,
    ...overrides,
  };
}

const meta = {
  title: 'Admin/ListingImages',
  component: ListingImages,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480, margin: '24px auto', background: '#fff', padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: { images: { control: 'object' } },
  args: { listingId: LISTING_ID, images: images(3) },
} satisfies Meta<typeof ListingImages>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const NoneYet: Story = { args: { images: images(0) } };

export const BelowMinimum: Story = { args: { images: images(3) } };

export const ReadyToApprove: Story = { args: { images: images(8) } };

export const Full: Story = { args: { images: images(20) } };

export const ReadOnly: Story = { args: { images: images(8, { canEdit: false }) } };
