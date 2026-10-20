import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LocationCard } from '@/components/dealers/location-card';

/**
 * Unit tests for `components/dealers/location-card.tsx`.
 *
 * The card looks like one feature and is two, so these cases are mostly about
 * the seam between them: the **button** is `mapsUrl`, the link the dealer
 * pasted (R6), and the **map** is `embedUrl`, which the API composes from what
 * that link turned out to carry. Following a share link is best-effort, so a
 * dealership with the link and no map is the ordinary case rather than an
 * error, and neither half may be composed from the address beside it.
 *
 * Which *shape* the embed takes — the place card with the yard's name, rating
 * and directions on it, or the plain pin — is settled on the server (R14) and
 * tested there, in `platform/maps/maps-link.test.ts`. The card renders the
 * frame it is handed, and these cases hold it to exactly that.
 */
const ADDRESS = {
  line: '14, Katpadi Main Road',
  city: 'Vellore',
  district: 'Vellore',
  state: 'Tamil Nadu',
  pincode: '632006',
  full: '14, Katpadi Main Road, Vellore 632006, Tamil Nadu',
  mapsUrl: 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
  geo: { lat: 12.9165, lng: 79.1325 },
  embedUrl:
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2000!2d79.1325!3d12.9165' +
    '!3m3!1m2!1s0xaaa%3A0xbbb!2sSri%20Lakshmi%20Motors!5e0',
};

describe('LocationCard', () => {
  it('points the frame at the URL the API composed, and nothing else', () => {
    const { container } = render(<LocationCard address={ADDRESS} brandName="Sri Lakshmi Motors" />);

    const frame = container.querySelector('iframe');
    // Verbatim. The card does not build, rewrite or second-guess this URL —
    // which is what lets the API change the shape of the map (R14) without the
    // card knowing there is more than one.
    expect(frame?.getAttribute('src')).toBe(ADDRESS.embedUrl);
    expect(frame?.getAttribute('loading')).toBe('lazy');
  });

  it('names the frame, because a screen reader otherwise announces "iframe"', () => {
    const { container } = render(<LocationCard address={ADDRESS} brandName="Sri Lakshmi Motors" />);

    expect(container.querySelector('iframe')?.getAttribute('title')).toBe(
      'Map showing Sri Lakshmi Motors in Vellore',
    );
  });

  it('opens the dealer’s own link in a new tab, safely', () => {
    render(<LocationCard address={ADDRESS} brandName="Sri Lakshmi Motors" />);

    const link = screen.getByRole('link', { name: /get directions/i });
    expect(link).toHaveAttribute('href', ADDRESS.mapsUrl);
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  /**
   * The state a phone-shared link lands in when it could not be followed. The
   * button is what a buyer presses, and it must not wait on the map.
   */
  it('keeps the directions button when there is no map', () => {
    const { container } = render(
      <LocationCard
        address={{ ...ADDRESS, geo: null, embedUrl: null }}
        brandName="Sri Lakshmi Motors"
      />,
    );

    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByText(/Map — dealership location/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /get directions/i })).toBeInTheDocument();
  });

  /** And the reverse: a map outlives a link that was cleared. */
  it('keeps the map when there is no link', () => {
    const { container } = render(
      <LocationCard address={{ ...ADDRESS, mapsUrl: null }} brandName="Sri Lakshmi Motors" />,
    );

    expect(container.querySelector('iframe')).not.toBeNull();
    expect(screen.queryByRole('link', { name: /get directions/i })).toBeNull();
  });

  /**
   * The rule the whole card exists to keep. An address is several gates in one
   * district; a map centred on the wrong one is worse than no map, because it
   * looks authoritative.
   */
  it('never falls back to the address for either half', () => {
    const { container } = render(
      <LocationCard
        address={{ ...ADDRESS, mapsUrl: null, geo: null, embedUrl: null }}
        brandName="Sri Lakshmi Motors"
      />,
    );

    expect(container.innerHTML).not.toContain('google.com');
    expect(container.innerHTML).not.toContain('Katpadi');
    expect(screen.getByText(/Map — dealership location/i)).toBeInTheDocument();
  });
});
