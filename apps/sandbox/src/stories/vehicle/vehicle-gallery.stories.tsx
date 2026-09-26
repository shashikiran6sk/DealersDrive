import type { PublicVehicleImage } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { VehicleGallery } from '@/components/vehicle/vehicle-gallery';

const SHADES = ['1f2937', '374151', '4b5563', '0f172a', '1e293b', '334155', '475569', '111827'];

function images(count: number): PublicVehicleImage[] {
  return Array.from({ length: count }, (_, index) => ({
    url: `https://placehold.co/1200x900/${SHADES[index % SHADES.length] ?? '1f2937'}/e5e7eb.png?text=Photo+${index + 1}`,
    alt: `2023 Hyundai Creta SX(O), photograph ${index + 1} of ${count}`,
  }));
}

const meta = {
  title: 'Vehicle/VehicleGallery',
  component: VehicleGallery,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720, margin: '24px auto' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: { primaryIndex: { control: { type: 'number', min: 0 } } },
  args: { images: images(8), primaryIndex: 0 },
} satisfies Meta<typeof VehicleGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const PrimaryNotFirst: Story = { args: { primaryIndex: 3 } };

export const OnePhoto: Story = { args: { images: images(1) } };

export const NoPhotos: Story = { args: { images: [] } };

export const Twenty: Story = { args: { images: images(20) } };
