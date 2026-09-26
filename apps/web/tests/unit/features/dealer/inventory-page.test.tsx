import type { DealerInventoryResponse } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import InventoryPage from '@/app/(dealer)/dealer/inventory/page';
import type * as ApiModule from '@/lib/api';

const apiGetParsed = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown };
});

function inventory(overrides: Partial<DealerInventoryResponse> = {}): DealerInventoryResponse {
  return {
    data: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: '2023 Hyundai Creta SX(O)',
        registrationDisplay: 'KA 01 AB 1234',
        summary: 'Petrol · Automatic · 22,400 km',
        priceLabel: '₹14,50,000',
        status: 'PENDING_REVIEW',
        statusLabel: 'Pending review',
        statusTone: 'warn',
        reason: null,
        complete: true,
        updatedAt: '2026-09-20T00:00:00.000Z',
        updatedLabel: '20 Sep 2026',
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Tata Nexon',
        registrationDisplay: 'TN 09 BX 0001',
        summary: '',
        priceLabel: null,
        status: 'CHANGES_REQUESTED',
        statusLabel: 'Changes requested',
        statusTone: 'warn',
        reason: 'The variant is wrong.',
        complete: true,
        updatedAt: '2026-09-19T00:00:00.000Z',
        updatedLabel: '19 Sep 2026',
      },
    ],
    page: { nextCursor: null, hasMore: false },
    counts: { ALL: 2, PENDING_REVIEW: 1, CHANGES_REQUESTED: 1 },
    ...overrides,
  };
}

async function page(params: Record<string, string> = {}) {
  return InventoryPage({ searchParams: Promise.resolve(params) });
}

describe('/dealer/inventory', () => {
  it('reads the dealer’s inventory uncached, passing only a valid status and the search', async () => {
    apiGetParsed.mockResolvedValue(inventory());
    render(await page({ status: 'PENDING_REVIEW', q: ' creta ', dealerId: 'x' }));

    expect(apiGetParsed).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/dealer/vehicles?status=PENDING_REVIEW&q=creta',
      { revalidate: false },
    );
  });

  it('ignores a status it does not know rather than sending it', async () => {
    apiGetParsed.mockResolvedValue(inventory());
    render(await page({ status: 'APPROVED' }));
    expect(apiGetParsed).toHaveBeenLastCalledWith(expect.anything(), '/v1/dealer/vehicles', {
      revalidate: false,
    });
  });

  it('shows every status as a tab with its count, and marks the current one', async () => {
    apiGetParsed.mockResolvedValue(inventory());
    render(await page({ status: 'CHANGES_REQUESTED' }));

    const tabs = within(screen.getByRole('navigation', { name: 'Filter by status' }));
    expect(tabs.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'All2',
      'Draft0',
      'Pending review1',
      'Changes requested1',
      'Active0',
      'Sold0',
      'Removed0',
    ]);
    expect(tabs.getByRole('link', { name: /Changes requested/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('renders identity, price and status, and the moderator’s words on a row sent back', async () => {
    apiGetParsed.mockResolvedValue(inventory());
    render(await page());

    const table = screen.getByRole('table');
    expect(within(table).getByText('2023 Hyundai Creta SX(O)')).toBeInTheDocument();
    expect(within(table).getByText('KA 01 AB 1234')).toBeInTheDocument();
    expect(within(table).getByText('₹14,50,000')).toBeInTheDocument();
    expect(within(table).getAllByText('Pending review').length).toBeGreaterThan(0);
    expect(within(table).getByText(/The variant is wrong/)).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/dealer/vehicles/22222222-2222-4222-8222-222222222222/edit?step=review',
    );
  });

  it('invites a first vehicle when the inventory is empty', async () => {
    apiGetParsed.mockResolvedValue(inventory({ data: [], counts: { ALL: 0 } }));
    render(await page());

    expect(screen.getByText('No vehicles yet')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Add vehicle' }).length).toBe(2);
  });

  it('says nothing matches a filter, without the first-vehicle invitation', async () => {
    apiGetParsed.mockResolvedValue(inventory({ data: [] }));
    render(await page({ q: 'zzz' }));
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('offers the next page when there is one', async () => {
    apiGetParsed.mockResolvedValue(inventory({ page: { nextCursor: 'abc', hasMore: true } }));
    render(await page({ status: 'ACTIVE' }));
    expect(screen.getByRole('link', { name: 'Show more' })).toHaveAttribute(
      'href',
      '/dealer/inventory?status=ACTIVE&cursor=abc',
    );
  });
});
