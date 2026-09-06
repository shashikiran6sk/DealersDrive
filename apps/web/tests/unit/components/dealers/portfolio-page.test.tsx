import type { DealerPublicProfile } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type * as ApiModule from '@/lib/api';
import DealerPortfolioPage, { generateMetadata } from '@/app/(public)/dealers/[slug]/page';
import { ApiError } from '@/lib/api';

/**
 * `/dealers/[slug]` — one dealership's public page.
 *
 * The assertions that matter here are the ones a restyle cannot break and a
 * careless edit can:
 *
 *   · **No phone number reaches the document**, in the rendered page or in the
 *     JSON-LD. Structured data is the easiest place in a page to leak a field
 *     nobody meant to publish, so it is scanned as text rather than trusted.
 *   · **"Get directions" is the dealer's own link or nothing** (R6). A
 *     dealership that predates the question gets no button, and no URL is
 *     composed from the address to fill the gap.
 *   · **A dealership that is not ACTIVE is a 404**, not a thin page.
 *
 * Nothing here pins the 170px cover or the 46px logo overhang.
 */
const apiGet = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiGet: (path: string) => apiGet(path) as unknown,
}));

const DEALER: DealerPublicProfile = {
  slug: 'sri-lakshmi-motors',
  brandName: 'Sri Lakshmi Motors',
  legalName: 'Sri Lakshmi Motors Pvt Ltd',
  initials: 'SL',
  isVerified: true,
  about: 'Family-run since 1998, and every car is inspected in-house.',
  services: ['Hatchbacks', 'RC transfer'],
  address: {
    line: '12 Katpadi Road',
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
    pincode: '632001',
    full: '12 Katpadi Road, Vellore 632001, Tamil Nadu',
    mapsUrl: 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
  },
  stats: [
    { key: 'cars', label: 'Cars available', value: '0' },
    { key: 'years', label: 'Years operating', value: '27' },
    { key: 'location', label: 'Location', value: 'Vellore' },
    { key: 'response', label: 'Response time', value: 'New dealer' },
  ],
  contact: [
    { key: 'phone', label: 'Phone', value: 'Tap to reveal', masked: true },
    { key: 'city', label: 'City', value: 'Vellore, Tamil Nadu' },
    { key: 'gstin', label: 'GSTIN', value: '33AABCS1429B1ZX', mono: true },
  ],
  logoUrl: null,
  coverUrl: null,
  seo: {
    canonical: 'http://localhost:3000/dealers/sri-lakshmi-motors',
    title: 'Sri Lakshmi Motors — used cars in Vellore | Dealers-Drive',
    isIndexable: false,
  },
};

const params = Promise.resolve({ slug: 'sri-lakshmi-motors' });

function serve(dealer: DealerPublicProfile | ApiError): void {
  apiGet.mockImplementation(() =>
    dealer instanceof ApiError ? Promise.reject(dealer) : Promise.resolve(dealer),
  );
}

const notListed = () =>
  new ApiError({
    type: 'about:blank',
    title: 'Not found',
    status: 404,
    code: 'NOT_FOUND',
    detail: 'That dealership is not listed.',
  });

describe('the dealership it shows', () => {
  it('renders the identity, the address and the registered name', async () => {
    serve(DEALER);
    render(await DealerPortfolioPage({ params }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sri Lakshmi Motors');
    expect(screen.getByText('VERIFIED DEALER')).toBeInTheDocument();
    expect(screen.getByText('12 Katpadi Road, Vellore 632001, Tamil Nadu')).toBeInTheDocument();
    expect(screen.getByText('Sri Lakshmi Motors Pvt Ltd')).toBeInTheDocument();
  });

  it('renders the four stats the API composed, rather than deriving them again', async () => {
    serve(DEALER);
    render(await DealerPortfolioPage({ params }));

    expect(screen.getByText('Cars available')).toBeInTheDocument();
    expect(screen.getByText('27')).toBeInTheDocument();
    expect(screen.getByText('New dealer')).toBeInTheDocument();
  });

  it('renders every contact row, including the masked one', async () => {
    serve(DEALER);
    render(await DealerPortfolioPage({ params }));

    expect(screen.getByText('Tap to reveal')).toBeInTheDocument();
    expect(screen.getByText('33AABCS1429B1ZX')).toBeInTheDocument();
  });

  it('falls back to a sentence when the dealership wrote no description', async () => {
    serve({ ...DEALER, about: null });
    render(await DealerPortfolioPage({ params }));

    expect(screen.getByText(/has not written an introduction yet/i)).toBeInTheDocument();
  });
});

/**
 * Rule 7, from the outside. A dealer's number appears in no ordinary public
 * response, and `POST /v1/vehicles/:id/reveal-contact` is the only route that
 * yields one — so nothing on this page can render one, including the parts a
 * person never reads.
 */
describe('the phone number', () => {
  it('appears nowhere in the document, JSON-LD included', async () => {
    serve(DEALER);
    const { container } = render(await DealerPortfolioPage({ params }));

    expect(container.textContent ?? '').not.toMatch(/\b[6-9]\d{9}\b/);
    const jsonLd = container.querySelector('script[type="application/ld+json"]');
    expect(jsonLd?.textContent ?? '').not.toMatch(/\b[6-9]\d{9}\b/);
    expect(jsonLd?.textContent ?? '').not.toContain('telephone');
  });
});

/**
 * R6. The dealer's own pin, or nothing — never a URL built from the address
 * string, which is several different gates in one district.
 */
describe('get directions', () => {
  it('links to the dealer’s own Maps link, in a new tab', async () => {
    serve(DEALER);
    render(await DealerPortfolioPage({ params }));

    const link = screen.getByRole('link', { name: /get directions/i });
    expect(link).toHaveAttribute('href', 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('is absent, not broken, for a dealership that predates the question', async () => {
    serve({ ...DEALER, address: { ...DEALER.address, mapsUrl: null } });
    const { container } = render(await DealerPortfolioPage({ params }));

    expect(screen.queryByRole('link', { name: /get directions/i })).toBeNull();
    // And nothing was composed from the address to stand in for it.
    expect(container.innerHTML).not.toContain('maps.google');
    expect(container.innerHTML).not.toContain('/maps/dir/');
  });
});

describe('the inventory section', () => {
  /**
   * Until F076 there is no inventory to filter. What stands there is the empty
   * state this page would show anyway for a dealership that has listed nothing
   * — and the count beside the heading comes from the same stat the API sent,
   * so the two cannot disagree.
   */
  it('says the dealership has listed nothing, and agrees with the stat', async () => {
    serve(DEALER);
    render(await DealerPortfolioPage({ params }));

    expect(screen.getByText('0 cars available')).toBeInTheDocument();
    expect(screen.getByText(/has no cars listed yet/i)).toBeInTheDocument();
  });

  it('says "1 car available", not "1 cars available"', async () => {
    serve({
      ...DEALER,
      stats: DEALER.stats.map((s) => (s.key === 'cars' ? { ...s, value: '1' } : s)),
    });
    render(await DealerPortfolioPage({ params }));

    expect(screen.getByText('1 car available')).toBeInTheDocument();
  });
});

describe('a dealership that is not listed', () => {
  it('404s rather than rendering a thin page', async () => {
    serve(notListed());

    await expect(DealerPortfolioPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  /** A 500 is not a 404 — the guard is narrow on purpose. */
  it('lets a real failure through', async () => {
    serve(new ApiError({ type: 'about:blank', title: 'Internal', status: 500, code: 'INTERNAL' }));

    await expect(DealerPortfolioPage({ params })).rejects.toThrow(ApiError);
  });
});

describe('metadata', () => {
  it('uses the title the API composed, and its canonical', async () => {
    serve(DEALER);
    const meta = await generateMetadata({ params });

    expect(meta.title).toEqual({
      absolute: 'Sri Lakshmi Motors — used cars in Vellore | Dealers-Drive',
    });
    expect(meta.alternates?.canonical).toBe('http://localhost:3000/dealers/sri-lakshmi-motors');
  });

  /**
   * §17.2 — A9 knows the live-listing count and this layer does not, so the
   * API's answer wins. Every dealership is `noindex` until F064, which is
   * right: a portfolio with nothing in it is not a page to send anybody to.
   */
  it('defers to the API on whether the page may be indexed', async () => {
    serve(DEALER);
    expect((await generateMetadata({ params })).robots).toEqual({ index: false, follow: true });

    serve({ ...DEALER, seo: { ...DEALER.seo, isIndexable: true } });
    expect((await generateMetadata({ params })).robots).toEqual({ index: true, follow: true });
  });

  it('does not invent a locality for a dealership that has none', async () => {
    serve({
      ...DEALER,
      about: null,
      address: { ...DEALER.address, city: '', full: '' },
    });

    expect((await generateMetadata({ params })).description).toBe(
      'Sri Lakshmi Motors is a verified independent used-car dealership.',
    );
  });

  it('titles a missing dealership rather than throwing', async () => {
    serve(notListed());

    expect(await generateMetadata({ params })).toEqual({ title: 'Dealership not found' });
  });
});
