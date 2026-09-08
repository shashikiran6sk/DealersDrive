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
  tagline: 'Family-run since 1998, and every car is inspected in-house.',
  services: ['Hatchbacks', 'RC transfer'],
  address: {
    line: '12 Katpadi Road',
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
    pincode: '632001',
    full: '12 Katpadi Road, Vellore 632001, Tamil Nadu',
    mapsUrl: 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
    geo: { lat: 12.9165, lng: 79.1325 },
    embedUrl:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2000!2d79.1325!3d12.9165' +
      '!3m3!1m2!1s0xaaa%3A0xbbb!2sSri%20Lakshmi%20Motors!5e0',
  },
  stats: [
    { key: 'cars', label: 'Cars available', value: '0' },
    { key: 'years', label: 'Years operating', value: '27' },
    { key: 'location', label: 'Location', value: 'Vellore' },
    { key: 'response', label: 'Response time', value: 'New dealer' },
  ],
  contact: [
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
  it('renders the identity and the address', async () => {
    serve(DEALER);
    render(await DealerPortfolioPage({ params }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sri Lakshmi Motors');
    expect(screen.getByText('VERIFIED DEALER')).toBeInTheDocument();
    expect(screen.getByText('12 Katpadi Road, Vellore 632001, Tamil Nadu')).toBeInTheDocument();
  });

  /**
   * R16 — the registered name is not in the rendered page any more. It was a
   * third line under the trading name saying, on every dealership on the
   * platform, the same string as the heading two lines above it: `brandName` is
   * the server-written mirror of `legalName`, so the pair could only ever
   * disagree by way of a feature that does not exist.
   *
   * It stays in the `AutoDealer` structured data, where `legalName` is a
   * distinct property with a defined meaning and costs a reader nothing.
   */
  it('does not repeat the registered name under the trading one', async () => {
    serve(DEALER);
    const { container } = render(await DealerPortfolioPage({ params }));

    expect(screen.queryByText('Sri Lakshmi Motors Pvt Ltd')).toBeNull();
    const jsonLd = container.querySelector('script[type="application/ld+json"]');
    expect(jsonLd?.textContent ?? '').toContain('Sri Lakshmi Motors Pvt Ltd');
  });

  /**
   * R15 — the stats are rows in the details card now, not a grid of their own,
   * and they are still the ones the API composed rather than a second
   * derivation of the same facts.
   */
  it('renders the stats the API composed, rather than deriving them again', async () => {
    serve(DEALER);
    render(await DealerPortfolioPage({ params }));

    expect(screen.getByText('Cars available')).toBeInTheDocument();
    expect(screen.getByText('27')).toBeInTheDocument();
    expect(screen.getByText('New dealer')).toBeInTheDocument();
  });

  /**
   * The one stat that is not carried across. `contact` already has a City row
   * with the state on it; two rows saying Vellore in one list is the kind of
   * duplicate that was invisible while they lived in separate blocks.
   */
  it('does not say the town twice in the one list', async () => {
    serve(DEALER);
    render(await DealerPortfolioPage({ params }));

    expect(screen.getByText('Vellore, Tamil Nadu')).toBeInTheDocument();
    expect(screen.queryByText('Location', { selector: 'dt' })).toBeNull();
  });

  it('renders every contact row the API sent', async () => {
    serve(DEALER);
    render(await DealerPortfolioPage({ params }));

    expect(screen.getByText('Vellore, Tamil Nadu')).toBeInTheDocument();
    expect(screen.getByText('33AABCS1429B1ZX')).toBeInTheDocument();
  });

  /**
   * R16 — and no phone row, because nothing on this page could act on one. The
   * reveal is A7, which is vehicle-scoped; an invitation with no control behind
   * it reads as a button a buyer failed to find.
   */
  it('offers no phone row to tap', async () => {
    serve(DEALER);
    render(await DealerPortfolioPage({ params }));

    expect(screen.queryByText(/tap to reveal/i)).toBeNull();
    expect(screen.queryByText('Phone', { selector: 'dt' })).toBeNull();
  });

  /** A stat with no value is an em dash, not a blank `<dd>` reading as a fault. */
  it('shows an em dash for a stat the API sent empty', async () => {
    serve({
      ...DEALER,
      stats: DEALER.stats.map((s) => (s.key === 'response' ? { ...s, value: '' } : s)),
    });
    render(await DealerPortfolioPage({ params }));

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  /**
   * R25 — the tagline is the header's one line of prose, under the name and
   * above the address, and it is the only prose the page has now. The `about`
   * paragraph that used to open the details card is not rendered anywhere.
   */
  it('renders the tagline under the dealership name', async () => {
    serve(DEALER);
    const { container } = render(await DealerPortfolioPage({ params }));

    const tagline = screen.getByText(DEALER.tagline as string);

    expect(tagline.tagName).toBe('P');
    // 16px — `body-lg`, DESIGN-SPEC §1.3. Larger than the 14px address it sits
    // above, smaller than the 34px name it sits under.
    expect(tagline.className).toContain('text-[16px]');
    // Under the name, before the address: the header's identity column, in
    // reading order.
    const heading = container.querySelector('h1');
    expect(heading?.parentElement?.parentElement).toContainElement(tagline);
    expect(heading?.compareDocumentPosition(tagline)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  /**
   * Nothing stands in for it. A placeholder sentence under the name is worse
   * than the gap: it is prose the dealership did not write, in the one place a
   * buyer reads as the dealership's own voice.
   */
  it('renders no line at all when the dealership wrote no tagline', async () => {
    serve({ ...DEALER, tagline: null });
    render(await DealerPortfolioPage({ params }));

    expect(screen.queryByText(/family-run since 1998/i)).toBeNull();
    expect(screen.queryByText(/has not written an introduction yet/i)).toBeNull();
  });
});

/**
 * The detail rows and the services chips are **one** card, beside the map — not
 * an "About the dealership" card and a "Contact" card saying, in two frames,
 * who this dealership is.
 *
 * The assertions are structural rather than visual, because what an edit
 * breaks here is the grouping and not the type: wrapping either half in a
 * heading and a `<section>` of its own renders identically on a phone, where
 * the info row is one column anyway, and silently puts the row back to three
 * columns on a laptop — with the map, the widest thing in it, the narrowest of
 * the three.
 */
describe('the dealership card', () => {
  it('keeps the facts and the services in one card', async () => {
    serve(DEALER);
    render(await DealerPortfolioPage({ params }));

    const card = screen.getByText('33AABCS1429B1ZX').closest('section');

    expect(card).not.toBeNull();
    expect(card).toHaveTextContent('RC transfer');
    // R25 — and the introduction is not in it, or anywhere else on the page.
    expect(card).not.toHaveTextContent(DEALER.tagline as string);
  });

  /** Two cards in the info row, and the map is the second of them. */
  it('leaves the info row at two cards', async () => {
    serve(DEALER);
    const { container } = render(await DealerPortfolioPage({ params }));

    const cards = container.querySelectorAll('section');
    expect(cards).toHaveLength(2);
    expect(cards[1]).toContainElement(container.querySelector('iframe'));
  });

  it('renders every service the dealership listed', async () => {
    serve(DEALER);
    const { container } = render(await DealerPortfolioPage({ params }));

    expect([...container.querySelectorAll('.tag')].map((tag) => tag.textContent)).toEqual([
      'Hatchbacks',
      'RC transfer',
    ]);
  });

  /**
   * A dealership that has named none gets no strip and no empty hairline above
   * it — the divider belongs to the chips, so it may not outlive them.
   */
  it('renders no services strip for a dealership that named none', async () => {
    serve({ ...DEALER, services: [] });
    const { container } = render(await DealerPortfolioPage({ params }));

    expect(container.querySelectorAll('.tag')).toHaveLength(0);
    // The facts are still there — only the chips are gone.
    expect(screen.getByText('33AABCS1429B1ZX')).toBeInTheDocument();
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
 * The map, and the fact that it is drawn from what the dealer's *link* resolved
 * to rather than from the address string beside it.
 *
 * These are two independent halves of one card: a dealership can have the link
 * and no map, because a `maps.app.goo.gl` share link carries neither a pin nor
 * a place until it is followed and following it is best-effort. Neither half is
 * ever composed from the typed address — a map confidently centred on the wrong
 * gate is worse than no map, because it looks authoritative.
 */
describe('the location map', () => {
  it('draws the map the API composed', async () => {
    serve(DEALER);
    const { container } = render(await DealerPortfolioPage({ params }));

    const frame = container.querySelector('iframe');
    expect(frame?.getAttribute('src')).toBe(DEALER.address.embedUrl);
    // Named for a screen reader, which otherwise announces "iframe".
    expect(frame?.getAttribute('title')).toMatch(/Sri Lakshmi Motors/);
  });

  it('shows the slot, not a map of the town, when no pin was resolved', async () => {
    serve({ ...DEALER, address: { ...DEALER.address, geo: null, embedUrl: null } });
    const { container } = render(await DealerPortfolioPage({ params }));

    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByText(/Map — dealership location/i)).toBeInTheDocument();
    // Not fallen back to the address string, which is the whole point.
    expect(container.innerHTML).not.toContain('Katpadi+Road');
    expect(container.innerHTML).not.toContain('output=embed');
  });

  /** The button does not wait on the map, and the map does not wait on it. */
  it('keeps the directions button when there is no map', async () => {
    serve({ ...DEALER, address: { ...DEALER.address, geo: null, embedUrl: null } });
    render(await DealerPortfolioPage({ params }));

    expect(screen.getByRole('link', { name: /get directions/i })).toBeInTheDocument();
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
    // No link and therefore no pin: the pin is only ever read out of the link.
    serve({
      ...DEALER,
      address: { ...DEALER.address, mapsUrl: null, geo: null, embedUrl: null },
    });
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
      tagline: null,
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
