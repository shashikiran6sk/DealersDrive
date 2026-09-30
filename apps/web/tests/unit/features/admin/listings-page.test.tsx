import type { AdminListingsResponse, AdminReactivationsResponse } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AdminListingsPage from '@/app/(admin)/admin/listings/page';
import type * as ApiModule from '@/lib/api';

const apiGetParsed = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown };
});

function listings(overrides: Partial<AdminListingsResponse> = {}): AdminListingsResponse {
  return {
    status: 'PENDING_REVIEW',
    data: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        vehicleId: '22222222-2222-4222-8222-222222222222',
        title: '2023 Hyundai Creta SX(O)',
        registrationDisplay: 'KA 01 AB 1234',
        summary: 'Petrol · Automatic · 22,400 km',
        priceLabel: '₹14,50,000',
        status: 'PENDING_REVIEW',
        statusLabel: 'Pending review',
        statusTone: 'warn',
        dealer: {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Sri Lakshmi Motors',
          slug: 'sri',
        },
        location: 'Katpadi, Vellore',
        submittedAt: '2026-09-26T09:00:00.000Z',
        submittedLabel: '26 Sep 2026',
        waitingLabel: '3 hours ago',
        resubmission: true,
        photography: { status: 'NOT_STARTED', label: 'Not photographed', tone: 'neutral' },
        imageCount: 0,
      },
    ],
    page: { nextCursor: null, hasMore: false },
    counts: { PENDING_REVIEW: 4, ACTIVE: 12 },
    reactivationPending: 2,
    ...overrides,
  };
}

async function page(params: Record<string, string> = {}) {
  return AdminListingsPage({ searchParams: Promise.resolve(params) });
}

describe('/admin/listings', () => {
  it('reads the queue uncached, forwarding only a known status and the search', async () => {
    apiGetParsed.mockResolvedValue(listings());
    render(await page({ status: 'ACTIVE', q: ' creta ' }));
    expect(apiGetParsed).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/admin/listings?status=ACTIVE&q=creta',
      { revalidate: false },
    );

    render(await page({ status: 'APPROVED' }));
    expect(apiGetParsed).toHaveBeenLastCalledWith(expect.anything(), '/v1/admin/listings', {
      revalidate: false,
    });
  });

  it('shows how many are waiting and a tab per status', async () => {
    apiGetParsed.mockResolvedValue(listings());
    render(await page());

    expect(screen.getByText('4 awaiting review')).toBeInTheDocument();
    const tabs = within(screen.getByRole('navigation', { name: 'Filter by status' }));
    expect(tabs.getByRole('link', { name: /Pending review/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(tabs.getByRole('link', { name: /Active/ })).toHaveAttribute(
      'href',
      '/admin/listings?status=ACTIVE',
    );
  });

  it('shows the vehicle, the dealership, the price, where and how long it has waited', async () => {
    apiGetParsed.mockResolvedValue(listings());
    render(await page());

    const table = within(screen.getByRole('table'));
    expect(table.getByText('2023 Hyundai Creta SX(O)')).toBeInTheDocument();
    expect(table.getByRole('link', { name: 'Sri Lakshmi Motors' })).toHaveAttribute(
      'href',
      '/admin/dealers/33333333-3333-4333-8333-333333333333',
    );
    expect(table.getByText('₹14,50,000')).toBeInTheDocument();
    expect(table.getByText('Katpadi, Vellore')).toBeInTheDocument();
    expect(table.getByText('3 hours ago')).toBeInTheDocument();
    expect(table.getByText('Resubmitted')).toBeInTheDocument();
    expect(table.getByText('Not photographed')).toBeInTheDocument();
  });

  it('offers no one-click approve (R45)', async () => {
    apiGetParsed.mockResolvedValue(listings());
    render(await page());
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });

  it('says the queue is clear when nothing is waiting', async () => {
    apiGetParsed.mockResolvedValue(listings({ data: [], counts: {} }));
    render(await page());
    expect(screen.getByText('Queue clear')).toBeInTheDocument();
  });

  it('says nothing matches a search that finds nothing', async () => {
    apiGetParsed.mockResolvedValue(listings({ data: [] }));
    render(await page({ q: 'zzz' }));
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('offers a reactivation requests tab with the number waiting', async () => {
    apiGetParsed.mockResolvedValue(listings());
    render(await page());
    const tabs = within(screen.getByRole('navigation', { name: 'Filter by status' }));
    const tab = tabs.getByRole('link', { name: /Reactivation requests/ });
    expect(tab).toHaveAttribute('href', '/admin/listings?view=reactivation');
    expect(tab).toHaveTextContent('2');
  });
});

function requests(overrides: Partial<AdminReactivationsResponse> = {}): AdminReactivationsResponse {
  return {
    status: 'PENDING',
    data: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        status: 'PENDING',
        statusLabel: 'Reactivation pending approval',
        statusTone: 'warn',
        fromStatus: 'WITHDRAWN',
        fromStatusLabel: 'Withdrawn',
        toStatus: 'ACTIVE',
        toStatusLabel: 'Active',
        reason: 'Documents are back.',
        requestedAt: '2026-09-29T09:00:00.000Z',
        requestedLabel: '29 Sep 2026',
        reviewedAt: null,
        adminNote: null,
        listing: {
          id: '11111111-1111-4111-8111-111111111111',
          vehicleId: '22222222-2222-4222-8222-222222222222',
          title: '2023 Hyundai Creta SX(O)',
          registrationDisplay: 'KA 01 AB 1234',
          status: 'WITHDRAWN',
          statusLabel: 'Withdrawn',
          statusTone: 'neutral',
          slug: '2023-hyundai-creta-abc',
        },
        dealer: {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Sri Lakshmi Motors',
          slug: 'sri',
        },
        current: true,
      },
    ],
    page: { nextCursor: null, hasMore: false },
    counts: { PENDING: 1, REJECTED: 3 },
    ...overrides,
  };
}

describe('/admin/listings?view=reactivation', () => {
  it('reads the requests and the listing counts uncached, forwarding only a known status', async () => {
    apiGetParsed.mockImplementation((_schema: unknown, path: string) =>
      Promise.resolve(path.startsWith('/v1/admin/reactivation-requests') ? requests() : listings()),
    );
    render(await page({ view: 'reactivation', status: 'REJECTED' }));
    expect(apiGetParsed).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/admin/reactivation-requests?status=REJECTED',
      { revalidate: false },
    );
    render(await page({ view: 'reactivation', status: 'MAYBE' }));
    expect(apiGetParsed).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/admin/reactivation-requests',
      { revalidate: false },
    );
  });

  it('shows the car, the dealer, where the listing stands, the move asked for and the note', async () => {
    apiGetParsed.mockImplementation((_schema: unknown, path: string) =>
      Promise.resolve(path.startsWith('/v1/admin/reactivation-requests') ? requests() : listings()),
    );
    render(await page({ view: 'reactivation' }));

    expect(screen.getByRole('heading', { name: 'Reactivation requests' })).toBeInTheDocument();
    const table = within(screen.getByRole('table'));
    expect(table.getByRole('link', { name: '2023 Hyundai Creta SX(O)' })).toHaveAttribute(
      'href',
      '/admin/listings/11111111-1111-4111-8111-111111111111',
    );
    expect(table.getByRole('link', { name: 'Sri Lakshmi Motors' })).toHaveAttribute(
      'href',
      '/admin/dealers/33333333-3333-4333-8333-333333333333',
    );
    expect(table.getByText('Withdrawn → Active')).toBeInTheDocument();
    expect(table.getByText('29 Sep 2026')).toBeInTheDocument();
    expect(table.getByText('Documents are back.')).toBeInTheDocument();
    expect(table.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(table.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    const tabs = within(screen.getByRole('navigation', { name: 'Filter by status' }));
    expect(tabs.getByRole('link', { name: /Reactivation requests/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('says nothing is waiting when the pending tab is empty', async () => {
    apiGetParsed.mockImplementation((_schema: unknown, path: string) =>
      Promise.resolve(
        path.startsWith('/v1/admin/reactivation-requests')
          ? requests({ data: [], counts: {} })
          : listings(),
      ),
    );
    render(await page({ view: 'reactivation' }));
    expect(screen.getByText('Nothing waiting')).toBeInTheDocument();
  });
});
