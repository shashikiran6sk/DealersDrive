import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LocationCard } from '@/components/dealers/location-card';

const ADDRESS = {
  line: '14, Katpadi Main Road, Gandhi Nagar',
  city: 'Vellore',
  district: 'Vellore',
  state: 'Tamil Nadu',
  pincode: '632006',
  full: '14, Katpadi Main Road, Gandhi Nagar, Vellore 632006, Tamil Nadu',
  mapsUrl: 'https://www.google.com/maps/dir/?api=1&destination=12.9165%2C79.1325',
  geo: { lat: 12.9165, lng: 79.1325 },
  embedUrl: null,
};

const meta = {
  title: 'Dealers/LocationCard',
  component: LocationCard,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
  args: { address: ADDRESS, brandName: 'Sri Lakshmi Motors' },
} satisfies Meta<typeof LocationCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    address: ADDRESS,
    brandName: 'Sakthi Cars',
  },
};

export const PinOnly: Story = {};

export const DirectionsOnly: Story = {
  args: { address: { ...ADDRESS, geo: null, embedUrl: null } },
};

export const AddressOnly: Story = {
  args: { address: { ...ADDRESS, mapsUrl: null } },
};

export const Neither: Story = {
  args: { address: { ...ADDRESS, mapsUrl: null, geo: null, embedUrl: null } },
};
