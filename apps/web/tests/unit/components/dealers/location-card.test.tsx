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
  it('shows the public business address and one safe directions link without an iframe or Load Map', () => {
    const { container } = render(<LocationCard address={ADDRESS} brandName="Sri Lakshmi Motors" />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(ADDRESS.full)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get Directions' })).toHaveAttribute(
      'href',
      ADDRESS.mapsUrl,
    );
    expect(screen.getByRole('link')).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
  it('renders address and directions with no map coordinates', () => {
    render(
      <LocationCard
        address={{ ...ADDRESS, geo: null, embedUrl: null }}
        brandName="Sri Lakshmi Motors"
      />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', ADDRESS.mapsUrl);
  });
  it('handles incomplete destinations without a misleading link', () => {
    render(
      <LocationCard
        address={{ ...ADDRESS, full: '', mapsUrl: null, geo: null, embedUrl: null }}
        brandName="Sri Lakshmi Motors"
      />,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Address unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Directions are unavailable/)).toBeInTheDocument();
  });
});
