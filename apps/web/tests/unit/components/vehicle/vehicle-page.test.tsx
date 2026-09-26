import type { PublicVehicleDetail } from '@dealers-drive/contracts';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import VehiclePage, { generateMetadata } from '@/app/(public)/car/[slug]/page';
import { PriceBlock } from '@/components/vehicle/price-block';
import { SpecList } from '@/components/vehicle/spec-list';
import { VdpDealerCard } from '@/components/vehicle/vdp-dealer-card';
import { VehicleGallery } from '@/components/vehicle/vehicle-gallery';
import type * as ApiModule from '@/lib/api';

const apiGetParsed = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown };
});

const SLUG = '2023-hyundai-creta-sx-o-katpadi-3f9a1c2b';

function image(index: number) {
  return {
    url: `https://media.test/by-media/m${index}/1024.webp`,
    alt: `2023 Hyundai Creta SX(O), photograph ${index + 1} of 3`,
  };
}

function detail(overrides: Partial<PublicVehicleDetail> = {}): PublicVehicleDetail {
  return {
    slug: SLUG,
    title: '2023 Hyundai Creta SX(O)',
    year: 2023,
    priceLabel: '₹14,50,000',
    negotiabilityLabel: 'Fixed price',
    summary: 'Petrol · Automatic · 22,400 km',
    description: 'Single owner, full service history.',
    specs: [
      { label: 'Make', value: 'Hyundai' },
      { label: 'Registered at', value: 'TN 23' },
    ],
    images: [image(0), image(1), image(2)],
    primaryIndex: 1,
    publishedLabel: 'Listed 26 Sep 2026',
    dealer: {
      name: 'Sri Lakshmi Motors',
      slug: 'sri-lakshmi-motors',
      initials: 'SL',
      isVerified: true,
      location: 'Katpadi, Vellore',
    },
    ...overrides,
  };
}

afterEach(() => {
  apiGetParsed.mockReset();
});

describe('VehicleGallery', () => {
  it('opens on the primary photograph and counts from it', () => {
    render(<VehicleGallery images={detail().images} primaryIndex={1} />);

    const main = screen.getByRole('img', { name: '2023 Hyundai Creta SX(O), photograph 2 of 3' });
    expect(main).toHaveAttribute('src', 'https://media.test/by-media/m1/1024.webp');
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show photograph 2 of 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows the photograph a thumbnail is pressed for', () => {
    render(<VehicleGallery images={detail().images} primaryIndex={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show photograph 3 of 3' }));

    expect(
      screen.getByRole('img', { name: '2023 Hyundai Creta SX(O), photograph 3 of 3' }),
    ).toBeInTheDocument();
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  it('draws no strip for a single photograph', () => {
    render(<VehicleGallery images={[image(0)]} primaryIndex={0} />);
    expect(screen.queryByRole('list', { name: 'Photographs' })).not.toBeInTheDocument();
  });

  it('holds the frame with a labelled slot when there are none, and survives a bad index', () => {
    const { rerender } = render(<VehicleGallery images={[]} primaryIndex={0} />);
    expect(screen.getByRole('img', { name: 'Photographs coming soon' })).toBeInTheDocument();

    rerender(<VehicleGallery images={detail().images} primaryIndex={9} />);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });
});

describe('the price, specifications and dealer', () => {
  it('prints the price, or says it is on request', () => {
    const { rerender } = render(
      <PriceBlock priceLabel="₹14,50,000" negotiabilityLabel="Fixed price" />,
    );
    expect(screen.getByText('₹14,50,000')).toBeInTheDocument();
    expect(screen.getByText('Fixed price')).toBeInTheDocument();

    rerender(<PriceBlock priceLabel={null} negotiabilityLabel={null} />);
    expect(screen.getByText('Price on request')).toBeInTheDocument();
  });

  it('lists each specification as a term and its value', () => {
    render(<SpecList specs={detail().specs} />);
    expect(screen.getByText('Registered at').tagName).toBe('DT');
    expect(screen.getByText('TN 23').tagName).toBe('DD');
  });

  it('names the dealership, where it is, and links to it', () => {
    render(<VdpDealerCard dealer={detail().dealer} />);
    expect(screen.getByRole('heading', { name: 'Sri Lakshmi Motors' })).toBeInTheDocument();
    expect(screen.getByText('Katpadi, Vellore')).toBeInTheDocument();
    expect(screen.getByText('VERIFIED DEALER')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View dealership →' })).toHaveAttribute(
      'href',
      '/dealers/sri-lakshmi-motors',
    );
  });
});

describe('/car/[slug]', () => {
  it('reads the car by slug and renders the page', async () => {
    apiGetParsed.mockResolvedValue(detail());
    render(await VehiclePage({ params: Promise.resolve({ slug: SLUG }) }));

    expect(apiGetParsed).toHaveBeenCalledWith(expect.anything(), `/v1/vehicles/${SLUG}`, {
      revalidate: 60,
      tags: ['vehicles', `vehicle:${SLUG}`],
    });
    expect(
      screen.getByRole('heading', { level: 1, name: '2023 Hyundai Creta SX(O)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2023', { selector: '.dd-plate' })).toBeInTheDocument();
    expect(screen.getByText('₹14,50,000')).toBeInTheDocument();
    expect(screen.getByText('Single owner, full service history.')).toBeInTheDocument();
    const specs = within(screen.getByRole('region', { name: 'Specifications' }));
    expect(specs.getByText('Hyundai')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← All cars' })).toHaveAttribute('href', '/cars');
  });

  it('leaves out the description section when the dealer wrote none', async () => {
    apiGetParsed.mockResolvedValue(detail({ description: null }));
    render(await VehiclePage({ params: Promise.resolve({ slug: SLUG }) }));
    expect(screen.queryByRole('region', { name: 'From the dealer' })).not.toBeInTheDocument();
  });

  it.each([404, 400])('answers the API’s %i with the not-found page', async (status) => {
    const { ApiError } = await import('@/lib/api');
    apiGetParsed.mockRejectedValue(
      new ApiError({ type: 'x', title: 'Not found', status, code: 'VEHICLE_NOT_FOUND' }),
    );
    await expect(VehiclePage({ params: Promise.resolve({ slug: 'gone' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  it('lets any other failure through to the error page', async () => {
    apiGetParsed.mockRejectedValue(new Error('down'));
    await expect(VehiclePage({ params: Promise.resolve({ slug: SLUG }) })).rejects.toThrow('down');
  });

  it('titles, describes and canonicalises the page from the car', async () => {
    apiGetParsed.mockResolvedValue(detail());
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: SLUG }) });

    expect(metadata.title).toBe('2023 Hyundai Creta SX(O) — ₹14,50,000');
    expect(metadata.description).toBe(
      '2023 Hyundai Creta SX(O), Petrol · Automatic · 22,400 km. Sold by Sri Lakshmi Motors, a verified dealership on Dealers-Drive.',
    );
    expect(metadata.alternates?.canonical).toBe(`/car/${SLUG}`);
  });

  it('titles a missing car plainly', async () => {
    const { ApiError } = await import('@/lib/api');
    apiGetParsed.mockRejectedValue(
      new ApiError({ type: 'x', title: 'Not found', status: 404, code: 'VEHICLE_NOT_FOUND' }),
    );
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'gone' }) });
    expect(metadata.title).toBe('Car not found');
  });
});
