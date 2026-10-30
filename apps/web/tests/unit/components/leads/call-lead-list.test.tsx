import type { AdminCallLeadsResponse, CallLead, CallLeadsResponse } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminCallLeadsPage from '@/app/(admin)/admin/enquiries/calls/page';
import DealerCallLeadsPage from '@/app/(dealer)/dealer/enquiries/calls/page';
import { CallLeadList } from '@/components/leads/call-lead-list';
import type * as ApiModule from '@/lib/api';

const apiGetParsed = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown };
});

const LEAD: CallLead = {
  id: '11111111-1111-4111-8111-111111111111',
  customer: {
    name: 'Ravi Kumar',
    initials: 'RK',
    phoneDisplay: '+91 98400 12345',
    callHref: 'tel:+919840012345',
  },
  vehicle: {
    title: '2023 Hyundai Creta SX(O)',
    registrationDisplay: 'TN 01 AB 1234',
    href: '/car/hyundai-creta-2023',
  },
  revealCount: 1,
  firstRevealedLabel: '26 Oct 2026',
  lastRevealedAt: '2026-10-28T10:00:00.000Z',
  lastRevealedAgoLabel: '2 hr ago',
};

beforeEach(() => {
  apiGetParsed.mockReset();
});

describe('CallLeadList', () => {
  it('shows who revealed the number, for which car, with a call link', () => {
    render(<CallLeadList leads={[LEAD]} audience="dealer" nextHref={null} />);
    const item = within(screen.getByRole('list', { name: 'Call leads' })).getByRole('listitem');
    expect(within(item).getByText('Ravi Kumar')).toBeVisible();
    expect(within(item).getByRole('link', { name: '2023 Hyundai Creta SX(O)' })).toHaveAttribute(
      'href',
      '/car/hyundai-creta-2023',
    );
    expect(within(item).getByRole('link', { name: 'Call +91 98400 12345' })).toHaveAttribute(
      'href',
      'tel:+919840012345',
    );
    expect(within(item).getByText('First viewed 26 Oct 2026')).toBeVisible();
  });

  it('counts repeat views, and drops the call link when the number is gone', () => {
    render(
      <CallLeadList
        leads={[
          {
            ...LEAD,
            revealCount: 3,
            customer: { ...LEAD.customer, phoneDisplay: null, callHref: null },
            vehicle: { ...LEAD.vehicle, href: null },
          },
        ]}
        audience="dealer"
        nextHref="/dealer/enquiries/calls?cursor=abc"
      />,
    );
    expect(screen.getByText('Viewed 3 times since 26 Oct 2026')).toBeVisible();
    expect(screen.getByText('Number no longer on file')).toBeVisible();
    expect(screen.queryByRole('link', { name: /^Call / })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '2023 Hyundai Creta SX(O)' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Show more' })).toHaveAttribute(
      'href',
      '/dealer/enquiries/calls?cursor=abc',
    );
  });

  it('says so when there are none, in each audience’s words', () => {
    const { rerender } = render(<CallLeadList leads={[]} audience="dealer" nextHref={null} />);
    expect(screen.getByText(/reveals your number/)).toBeVisible();
    rerender(<CallLeadList leads={[]} audience="admin" nextHref={null} />);
    expect(screen.getByText(/revealed a dealership’s number/)).toBeVisible();
  });
});

describe('the Calls pages', () => {
  it('reads the dealership’s own leads, uncached', async () => {
    const response: CallLeadsResponse = {
      data: [LEAD],
      page: { nextCursor: 'next', hasMore: true },
    };
    apiGetParsed.mockResolvedValue(response);
    render(await DealerCallLeadsPage({ searchParams: Promise.resolve({ cursor: 'abc' }) }));
    expect(apiGetParsed).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/dealer/call-leads?cursor=abc',
      {
        revalidate: false,
      },
    );
    expect(screen.getByRole('heading', { name: 'Customer calls' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to enquiries' })).toHaveAttribute(
      'href',
      '/dealer/enquiries',
    );
    expect(screen.getByRole('link', { name: 'Show more' })).toHaveAttribute(
      'href',
      '/dealer/enquiries/calls?cursor=next',
    );
  });

  it('names the dealership for admins and keeps the dealership filter across pages', async () => {
    const response: AdminCallLeadsResponse = {
      data: [{ ...LEAD, dealer: { name: 'Sri Lakshmi Motors', slug: 'sri-lakshmi-motors' } }],
      page: { nextCursor: 'next', hasMore: true },
    };
    apiGetParsed.mockResolvedValue(response);
    render(
      await AdminCallLeadsPage({
        searchParams: Promise.resolve({ dealer: 'sri-lakshmi-motors' }),
      }),
    );
    expect(apiGetParsed).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/admin/call-leads?dealer=sri-lakshmi-motors',
      { revalidate: false },
    );
    expect(screen.getByText('Sri Lakshmi Motors')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Show more' })).toHaveAttribute(
      'href',
      '/admin/enquiries/calls?dealer=sri-lakshmi-motors&cursor=next',
    );
  });
});
