import type { PublicVehicleDetail, VehicleCardDto } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import VehiclePage, { generateMetadata } from '@/app/(public)/car/[slug]/page';
import { PriceBlock } from '@/components/vehicle/price-block';
import { SpecList } from '@/components/vehicle/spec-list';
import { VdpDealerCard } from '@/components/vehicle/vdp-dealer-card';
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
    availability: 'AVAILABLE',
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

function serve(car: PublicVehicleDetail, similar: VehicleCardDto[] = []) {
  apiGetParsed.mockImplementation((_schema: unknown, path: string) =>
    Promise.resolve(path.endsWith('/similar') ? { data: similar } : car),
  );
}

function similarCard(slug: string): VehicleCardDto {
  return {
    slug,
    availability: 'AVAILABLE',
    title: `2022 Kia Seltos ${slug}`,
    year: 2022,
    priceLabel: '₹13,20,000',
    metaLabel: '28,000 km · Petrol · Manual · Arcot',
    image: null,
    imageCount: 0,
    dealer: { name: 'Arcot Car Point', slug: 'arcot-car-point', initials: 'AC', isVerified: true },
  };
}

afterEach(() => {
  apiGetParsed.mockReset();
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
    serve(detail());
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

  it('shows a reserved car plainly as reserved, and offers no enquiry (R71)', async () => {
    serve(detail({ availability: 'RESERVED' }));
    render(await VehiclePage({ params: Promise.resolve({ slug: SLUG }) }));

    expect(screen.getAllByText('Reserved').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/reserved for another buyer/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enquire/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse available cars' })).toHaveAttribute(
      'href',
      '/cars',
    );
  });

  it('offers the enquiry on an available car, with no reserved notice', async () => {
    serve(detail());
    render(await VehiclePage({ params: Promise.resolve({ slug: SLUG }) }));

    expect(screen.getAllByRole('button', { name: /Enquire/ }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/reserved for another buyer/)).not.toBeInTheDocument();
  });

  it('shows similar vehicles under the page, each with its dealership and a link (R73)', async () => {
    serve(detail(), [similarCard('a'), similarCard('b')]);
    render(await VehiclePage({ params: Promise.resolve({ slug: SLUG }) }));

    expect(apiGetParsed).toHaveBeenCalledWith(expect.anything(), `/v1/vehicles/${SLUG}/similar`, {
      revalidate: 60,
      tags: ['vehicles', `vehicle:${SLUG}`],
    });
    const section = within(screen.getByRole('region', { name: 'Similar vehicles' }));
    expect(section.getAllByRole('article')).toHaveLength(2);
    expect(section.getByRole('link', { name: '2022 Kia Seltos a' })).toHaveAttribute(
      'href',
      '/car/a',
    );
    expect(section.getAllByText('Arcot Car Point')).toHaveLength(2);
  });

  it('leaves the section out when there is nothing similar, or the API fails', async () => {
    serve(detail(), []);
    const { unmount } = render(await VehiclePage({ params: Promise.resolve({ slug: SLUG }) }));
    expect(screen.queryByRole('region', { name: 'Similar vehicles' })).not.toBeInTheDocument();
    unmount();

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    apiGetParsed.mockImplementation((_schema: unknown, path: string) =>
      path.endsWith('/similar') ? Promise.reject(new Error('down')) : Promise.resolve(detail()),
    );
    render(await VehiclePage({ params: Promise.resolve({ slug: SLUG }) }));
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Similar vehicles' })).not.toBeInTheDocument();
  });

  it('leaves out the description section when the dealer wrote none', async () => {
    serve(detail({ description: null }));
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
    serve(detail());
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
