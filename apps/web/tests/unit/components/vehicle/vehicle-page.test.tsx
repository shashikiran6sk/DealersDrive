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
    facts: {
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX(O)',
      bodyType: 'SUV',
      fuelType: 'Petrol',
      transmission: 'Automatic',
      color: 'White',
      kilometersDriven: 22_400,
      ownerCount: 1,
      pricePaise: 145_000_000,
    },
    dealer: {
      name: 'Sri Lakshmi Motors',
      slug: 'sri-lakshmi-motors',
      initials: 'SL',
      isVerified: true,
      location: 'Katpadi, Vellore',
      city: 'Katpadi',
      district: 'Vellore',
      state: 'Tamil Nadu',
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
  vi.unstubAllEnvs();
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
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('WEB_BASE_URL', 'https://www.dealers-drive.com');
    serve(detail());
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: SLUG }) });

    expect(metadata.title).toBe('2023 Hyundai Creta SX(O) in Katpadi');
    expect(metadata.description).toBe(
      '2023 Hyundai Creta SX(O) for sale in Katpadi, Vellore at ₹14,50,000 — Petrol · Automatic · 22,400 km. Sold by Sri Lakshmi Motors, a verified dealership on Dealers-Drive.',
    );
    expect(metadata.alternates?.canonical).toBe(`https://www.dealers-drive.com/car/${SLUG}`);
    expect(metadata.robots).toEqual({ index: true, follow: true, 'max-image-preview': 'large' });
    vi.unstubAllEnvs();
  });

  it('shares the primary photograph, not the brand card', async () => {
    serve(detail());
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: SLUG }) });

    expect(metadata.openGraph).toMatchObject({
      title: '2023 Hyundai Creta SX(O) in Katpadi | Dealers-Drive',
      siteName: 'Dealers-Drive',
      url: `http://localhost:3000/car/${SLUG}`,
      images: [image(1)],
    });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', images: [image(1)] });
  });

  it('says a reserved car is reserved, and keeps its page indexable', async () => {
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('WEB_BASE_URL', 'https://www.dealers-drive.com');
    serve(detail({ availability: 'RESERVED' }));
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: SLUG }) });

    expect(metadata.description).toMatch(/^Reserved for another buyer\. /);
    expect(metadata.robots).toMatchObject({ index: true });
    vi.unstubAllEnvs();
  });

  it('never lets a non-production deployment be indexed', async () => {
    vi.stubEnv('APP_ENV', 'development');
    vi.stubEnv('WEB_BASE_URL', 'https://dev.dealers-drive.com');
    serve(detail());
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: SLUG }) });

    expect(metadata.robots).toEqual({ index: false, follow: false });
    vi.unstubAllEnvs();
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

describe('/car/[slug] structured data', () => {
  function graphOf(container: HTMLElement): Record<string, unknown>[] {
    const script = container.querySelector('script[type="application/ld+json"]');
    const parsed = JSON.parse(script?.textContent ?? '{}') as {
      '@graph'?: Record<string, unknown>[];
    };
    return parsed['@graph'] ?? [];
  }

  async function carNode(car: PublicVehicleDetail) {
    serve(car);
    const { container } = render(await VehiclePage({ params: Promise.resolve({ slug: SLUG }) }));
    return graphOf(container).find((node) => node['@type'] === 'Car');
  }

  it('describes the car from the facts the page prints, and nothing else', async () => {
    expect(await carNode(detail())).toEqual({
      '@type': 'Car',
      '@id': `http://localhost:3000/car/${SLUG}#vehicle`,
      name: '2023 Hyundai Creta SX(O)',
      url: `http://localhost:3000/car/${SLUG}`,
      description: 'Single owner, full service history.',
      image: [image(1).url, image(0).url, image(2).url],
      brand: { '@type': 'Brand', name: 'Hyundai' },
      model: 'Creta',
      vehicleConfiguration: 'SX(O)',
      vehicleModelDate: '2023',
      bodyType: 'SUV',
      fuelType: 'Petrol',
      vehicleTransmission: 'Automatic',
      color: 'White',
      mileageFromOdometer: { '@type': 'QuantitativeValue', value: 22_400, unitCode: 'KMT' },
      numberOfPreviousOwners: 1,
      itemCondition: 'https://schema.org/UsedCondition',
      offers: {
        '@type': 'Offer',
        url: `http://localhost:3000/car/${SLUG}`,
        price: 1_450_000,
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/UsedCondition',
        seller: {
          '@type': 'AutoDealer',
          '@id': 'http://localhost:3000/dealers/sri-lakshmi-motors#dealer',
          name: 'Sri Lakshmi Motors',
          url: 'http://localhost:3000/dealers/sri-lakshmi-motors',
        },
      },
    });
  });

  it('prices the offer at exactly the rupees the page shows', async () => {
    const node = await carNode(detail());
    const offer = node?.offers as { price: number };
    expect(`₹${offer.price.toLocaleString('en-IN')}`).toBe('₹14,50,000');
  });

  it('never calls a reserved car in stock', async () => {
    const node = await carNode(detail({ availability: 'RESERVED' }));
    expect(node?.offers).toMatchObject({ availability: 'https://schema.org/Reserved' });
  });

  it('makes no offer when the page shows no price', async () => {
    const node = await carNode(
      detail({ priceLabel: null, facts: { ...detail().facts, pricePaise: null } }),
    );
    expect(node).not.toHaveProperty('offers');
  });

  it('leaves out what the dealer never entered, rather than guessing', async () => {
    const node = await carNode(
      detail({
        description: null,
        facts: { ...detail().facts, color: null, kilometersDriven: null, ownerCount: null },
      }),
    );
    expect(node).not.toHaveProperty('description');
    expect(node).not.toHaveProperty('color');
    expect(node).not.toHaveProperty('mileageFromOdometer');
    expect(node).not.toHaveProperty('numberOfPreviousOwners');
  });

  it('breadcrumbs Home, Cars and the car', async () => {
    serve(detail());
    const { container } = render(await VehiclePage({ params: Promise.resolve({ slug: SLUG }) }));
    const trail = graphOf(container).find((node) => node['@type'] === 'BreadcrumbList');

    expect(trail?.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'http://localhost:3000/' },
      { '@type': 'ListItem', position: 2, name: 'Cars', item: 'http://localhost:3000/cars' },
      {
        '@type': 'ListItem',
        position: 3,
        name: '2023 Hyundai Creta SX(O)',
        item: `http://localhost:3000/car/${SLUG}`,
      },
    ]);
  });

  it('links the car to its dealership with a crawlable link', async () => {
    serve(detail());
    render(await VehiclePage({ params: Promise.resolve({ slug: SLUG }) }));

    expect(
      screen
        .getAllByRole('link')
        .some((link) => link.getAttribute('href') === '/dealers/sri-lakshmi-motors'),
    ).toBe(true);
  });
});
