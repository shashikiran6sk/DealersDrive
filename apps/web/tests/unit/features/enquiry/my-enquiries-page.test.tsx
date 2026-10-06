import type { CustomerEnquiriesResponse, CustomerEnquiry } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MyEnquiriesPage from '@/app/(public)/enquiries/page';
import type * as ApiModule from '@/lib/api';
import { ApiError } from '@/lib/api';

/**
 * A customer's own enquiries (**R68**): read-only, the current state only.
 * The API has already folded spam into Closed; this page shows what it is
 * given and sends a signed-out visitor to the Customer login and back.
 */
const apiGetParsed = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown };
});

const SENT: CustomerEnquiry = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'SENT',
  statusLabel: 'Sent',
  statusTone: 'accent',
  message: 'Is the price negotiable?',
  createdAt: '2026-09-28T10:30:00.000Z',
  createdLabel: '28 Sep 2026',
  dealerName: 'Sri Lakshmi Motors',
  vehicle: { title: '2023 Hyundai Creta SX(O)', href: '/car/2023-hyundai-creta-sx-o' },
};

function enquiries(overrides: Partial<CustomerEnquiriesResponse> = {}): CustomerEnquiriesResponse {
  return { data: [SENT], page: { nextCursor: null, hasMore: false }, ...overrides };
}

async function page(params: Record<string, string> = {}) {
  return MyEnquiriesPage({ searchParams: Promise.resolve(params) });
}

async function redirectOf(params: Record<string, string> = {}): Promise<string | null> {
  try {
    await page(params);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return message.startsWith('NEXT_REDIRECT:') ? message.slice('NEXT_REDIRECT:'.length) : null;
  }
}

beforeEach(() => {
  apiGetParsed.mockReset();
});

describe('/enquiries', () => {
  it('reads the customer’s enquiries uncached, passing only the cursor', async () => {
    apiGetParsed.mockResolvedValue(enquiries());
    render(await page({ cursor: 'abc', customerId: 'x' }));

    expect(apiGetParsed).toHaveBeenCalledWith(expect.anything(), '/v1/enquiries?cursor=abc', {
      revalidate: false,
    });
    expect(screen.getByRole('heading', { level: 1, name: 'My enquiries' })).toBeInTheDocument();
  });

  it('sends somebody not signed in as a customer to the login, and back here', async () => {
    apiGetParsed.mockRejectedValue(
      new ApiError({
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        code: 'UNAUTHORIZED',
      }),
    );

    expect(await redirectOf()).toBe('/login?returnTo=%2Fenquiries');
  });

  it('shows each enquiry’s car, dealership, message, date and status — and nothing to change', async () => {
    apiGetParsed.mockResolvedValue(enquiries());
    render(await page());

    const card = within(screen.getByRole('listitem'));
    expect(card.getByRole('link', { name: '2023 Hyundai Creta SX(O)' })).toHaveAttribute(
      'href',
      '/car/2023-hyundai-creta-sx-o',
    );
    expect(card.getByText('Sri Lakshmi Motors')).toBeInTheDocument();
    expect(card.getByText('Is the price negotiable?')).toBeInTheDocument();
    expect(card.getByText('Sent')).toBeInTheDocument();
    expect(card.getByText('Sent 28 Sep 2026')).toHaveAttribute(
      'datetime',
      '2026-09-28T10:30:00.000Z',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  /** R90 — a support request about this enquiry, with the enquiry already chosen. */
  it('offers help with each enquiry, through a support request', async () => {
    apiGetParsed.mockResolvedValue(enquiries());
    render(await page());

    const card = within(screen.getByRole('listitem'));
    expect(card.getByRole('link', { name: 'Get help with this enquiry' })).toHaveAttribute(
      'href',
      `/support-requests/new?enquiry=${SENT.id}`,
    );
  });

  it.each([
    ['CONTACTED', 'Contacted', 'ok'],
    ['CLOSED', 'Closed', 'neutral'],
  ] as const)('shows %s as %s', async (status, label, tone) => {
    apiGetParsed.mockResolvedValue(
      enquiries({ data: [{ ...SENT, status, statusLabel: label, statusTone: tone }] }),
    );
    render(await page());

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('names a car no longer listed without a link', async () => {
    apiGetParsed.mockResolvedValue(
      enquiries({ data: [{ ...SENT, message: null, vehicle: { ...SENT.vehicle, href: null } }] }),
    );
    render(await page());

    expect(screen.queryByRole('link', { name: /Creta/ })).toBeNull();
    expect(screen.getByText('· No longer listed')).toBeInTheDocument();
    expect(screen.getByText('No message — you asked to be contacted.')).toBeInTheDocument();
  });

  it('points somebody with no enquiries at the cars', async () => {
    apiGetParsed.mockResolvedValue(enquiries({ data: [] }));
    render(await page());

    expect(screen.getByText('No enquiries yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse cars' })).toHaveAttribute('href', '/cars');
  });

  it('links to the next page', async () => {
    apiGetParsed.mockResolvedValue(enquiries({ page: { nextCursor: 'next', hasMore: true } }));
    render(await page());

    expect(screen.getByRole('link', { name: 'Show more' })).toHaveAttribute(
      'href',
      '/enquiries?cursor=next',
    );
  });
});
