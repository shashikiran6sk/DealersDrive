import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LocationCard } from '@/components/dealers/location-card';

const ADDRESS = {
  line: '14, Katpadi Main Road, Gandhi Nagar',
  city: 'Vellore',
  district: 'Vellore',
  state: 'Tamil Nadu',
  pincode: '632006',
  full: '14, Katpadi Main Road, Gandhi Nagar, Vellore 632006, Tamil Nadu',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=12.9165,79.1325',
  geo: { lat: 12.9165, lng: 79.1325 },
  embedUrl: 'https://www.google.com/maps?q=12.9165,79.1325&z=16&output=embed',
};

const PLACE_EMBED =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2000!2d80.2000014!3d12.9797792' +
  '!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2' +
  '!1s0x3a525df9971c98e5%3A0x35fc11465038924f!2sSakthi%20Cars!5e0!3m2!1sen!2sin!4v0!5m2!1sen!2sin';

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
    address: { ...ADDRESS, embedUrl: PLACE_EMBED },
    brandName: 'Sakthi Cars',
  },
};

export const PinOnly: Story = {};

export const DirectionsOnly: Story = {
  args: { address: { ...ADDRESS, geo: null, embedUrl: null } },
};

export const MapOnly: Story = {
  args: { address: { ...ADDRESS, mapsUrl: null } },
};

export const Neither: Story = {
  args: { address: { ...ADDRESS, mapsUrl: null, geo: null, embedUrl: null } },
};
