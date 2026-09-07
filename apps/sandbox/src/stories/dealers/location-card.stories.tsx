import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LocationCard } from '@/components/dealers/location-card';

/**
 * The third card in the portfolio's info row.
 *
 * The thing to check by eye is that **the map and the button are independent**.
 * They look like one feature and are not: the button is `mapsUrl`, the link the
 * dealer pasted (**R6**), and the map is `geo`, the coordinates the API managed
 * to read out of that link at write time. A `maps.app.goo.gl` share link carries
 * no coordinates until it is followed, and following it is best-effort — so
 * `DirectionsOnly` below is not an error state, it is the ordinary outcome for a
 * dealership whose link could not be resolved.
 *
 * Neither half is ever composed from the address. A map confidently centred on
 * the wrong gate is worse than the slot, because it looks authoritative.
 *
 * ⚠️ The map is a live Google embed, so these stories load a real frame and need
 * the network. That is also what makes them worth looking at: the aspect ratio
 * and the way the frame sits inside the `Blueprint` border are the two things a
 * mock would get wrong.
 */
const ADDRESS = {
  line: '14, Katpadi Main Road, Gandhi Nagar',
  city: 'Vellore',
  district: 'Vellore',
  state: 'Tamil Nadu',
  pincode: '632006',
  full: '14, Katpadi Main Road, Gandhi Nagar, Vellore 632006, Tamil Nadu',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=12.9165,79.1325',
  geo: { lat: 12.9165, lng: 79.1325 },
};

const meta = {
  title: 'Dealers/LocationCard',
  component: LocationCard,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      // The info row's cell: `minmax(260px, 1fr)`.
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
  args: { address: ADDRESS, brandName: 'Sri Lakshmi Motors' },
} satisfies Meta<typeof LocationCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Both halves: a pin that resolved, and the dealer's own link under it. */
export const Default: Story = {};

/**
 * The ordinary outcome for a phone-shared link that could not be followed —
 * a timeout, or Google declining a server-side request. The slot names what is
 * missing and the button, which is the thing a buyer actually presses, is
 * untouched.
 */
export const DirectionsOnly: Story = {
  args: { address: { ...ADDRESS, geo: null } },
};

/**
 * A pin with no link. Not reachable through onboarding — the pin is read *out*
 * of the link — but the two fields are independently nullable in the contract,
 * and a card that dropped the map because the button was missing would be
 * hiding the one piece of information it still had.
 */
export const MapOnly: Story = {
  args: { address: { ...ADDRESS, mapsUrl: null } },
};

/** A dealership that predates R6. The card is a heading and a slot, not a gap. */
export const Neither: Story = {
  args: { address: { ...ADDRESS, mapsUrl: null, geo: null } },
};
