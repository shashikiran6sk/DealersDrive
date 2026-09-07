import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LocationCard } from '@/components/dealers/location-card';

/**
 * The portfolio's map, as a full-width block (**R22**).
 *
 * The thing to check by eye is that **the map and the button are independent**.
 * They look like one feature and are not: the button is `mapsUrl`, the link the
 * dealer pasted (**R6**), and the map is `embedUrl`, which the API composes
 * from whatever that link turned out to carry. A `maps.app.goo.gl` share link
 * carries neither a pin nor a place until it is followed, and following it is
 * best-effort — so `DirectionsOnly` below is not an error state, it is the
 * ordinary outcome for a dealership whose link could not be resolved.
 *
 * The second thing to check is the difference between `Default` and `PinOnly`,
 * which is what **R14** is for. A link that named a **place** comes back as
 * Google's place card — name, address, rating, review count, zoom controls and
 * a directions control, inside the frame. A link that only carried coordinates
 * comes back as an unlabelled dot. Both are real states; the first is worth the
 * place id it costs.
 *
 * ⚠️ **And the card only appears in a frame of about 400 × 300 or larger**
 * (**R22**) — Google collapses it to an "Open in Maps" button in anything
 * smaller, which is what every dealership on the platform used to get: the map
 * was the third card in a three-up row, 372px wide, and no link however good
 * could show a rating there. Widen this story's decorator below 400 and watch
 * the card become a button; that is the whole bug, reproducible in one drag.
 *
 * Neither half is ever composed from the address. A map confidently centred on
 * the wrong gate is worse than the slot, because it looks authoritative.
 *
 * ⚠️ The map is a live Google embed, so these stories load a real frame and need
 * the network. That is also what makes them worth looking at: the place card's
 * height against the frame's, and the way the frame sits inside the `Blueprint`
 * border, are the two things a mock would get wrong.
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
  embedUrl: 'https://www.google.com/maps?q=12.9165,79.1325&z=16&output=embed',
};

/**
 * A real dealership, and it has to be.
 *
 * A place card is drawn from Google's own feature id, so there is no way to
 * mock one: an invented id renders a blank frame, which would make this story
 * look like a bug in the component rather than the state it is meant to show.
 * So the one story that exercises the card names a dealership that exists —
 * the rest keep the fictional brand the other portfolio stories use.
 *
 * Built exactly as `embedUrlFor` builds it, so what is on screen here is what
 * ships. Note that the label in the blob (`!2s…`) is only a hint: Google
 * renders the place's own name from the id, which is why it can differ.
 */
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
      /*
        Half of the page column, which is what the map gets now that it sits
        beside Contact and nothing else (**R22**) — not the 320px three-up cell
        it used to. That cell is the bug: at 320, and at the 372 the real row
        gave it, Google draws an "Open in Maps" button instead of the place
        card, so a dealership's rating could never appear however good its link.
      */
      <div style={{ width: 608 }}>
        <Story />
      </div>
    ),
  ],
  args: { address: ADDRESS, brandName: 'Sri Lakshmi Motors' },
} satisfies Meta<typeof LocationCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The state **R14** exists for, and the one most dealerships land in: the link
 * named a place, so the frame carries the dealership's name, its address, its
 * rating and review count, the zoom buttons and a directions control — and the
 * card's own button underneath is then the second way to the same place, not
 * the only one.
 */
export const Default: Story = {
  args: {
    address: { ...ADDRESS, embedUrl: PLACE_EMBED },
    brandName: 'Sakthi Cars',
  },
};

/**
 * The same card for a link that carried coordinates and named nothing — a
 * hand-built `?q=lat,lng` share link, or a `/maps/@…` URL copied off the map
 * itself. An unlabelled dot, which is honest and is all there is to draw.
 */
export const PinOnly: Story = {};

/**
 * The ordinary outcome for a phone-shared link that could not be followed —
 * a timeout, or Google declining a server-side request. The slot names what is
 * missing and the button, which is the thing a buyer actually presses, is
 * untouched.
 */
export const DirectionsOnly: Story = {
  args: { address: { ...ADDRESS, geo: null, embedUrl: null } },
};

/**
 * A map with no link. Not reachable through onboarding — the map is composed
 * *from* the link — but the two fields are independently nullable in the
 * contract, and a card that dropped the map because the button was missing
 * would be hiding the one piece of information it still had.
 */
export const MapOnly: Story = {
  args: { address: { ...ADDRESS, mapsUrl: null } },
};

/** A dealership that predates R6. The card is a heading and a slot, not a gap. */
export const Neither: Story = {
  args: { address: { ...ADDRESS, mapsUrl: null, geo: null, embedUrl: null } },
};
