import type {
  AdminEnquiriesResponse,
  AdminEnquiryDetail,
  AdminEnquiryRow,
} from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AdminEnquiryPage from '@/app/(admin)/admin/enquiries/[id]/page';
import AdminEnquiriesLoading from '@/app/(admin)/admin/enquiries/loading';
import AdminEnquiryLoading from '@/app/(admin)/admin/enquiries/[id]/loading';
import AdminEnquiriesPage from '@/app/(admin)/admin/enquiries/page';
import type * as ApiModule from '@/lib/api';

/**
 * R89 — `/admin/enquiries` and `/admin/enquiries/[id]`.
 *
 * The pages compute nothing: they forward only filters the API understands,
 * read uncached, and render what comes back. What is worth pinning is which
 * query goes out, what the operator is told when nothing matches, and that
 * the detail shows the whole context — with no control that changes it.
 */
const apiGetParsed = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown };
});

const ID = '11111111-1111-4111-8111-111111111111';

const ROW: AdminEnquiryRow = {
  id: ID,
  status: 'CONTACTED',
  statusLabel: 'Contacted',
  statusTone: 'ok',
  messagePreview: 'Is the service history available?',
  createdAt: '2026-09-26T09:02:00.000Z',
  createdLabel: '26 Sep 2026, 14:32',
  customer: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Meera Iyer',
    phoneDisplay: '+91 98400 12345',
  },
  dealer: { id: '33333333-3333-4333-8333-333333333333', name: 'Sri Lakshmi Motors', slug: 'sri' },
  vehicle: {
    listingId: '44444444-4444-4444-8444-444444444444',
    title: '2021 Honda City VX',
    registrationDisplay: 'TN 09 BX 0001',
    listingStatus: 'SOLD',
    listingStatusLabel: 'Sold',
    listingStatusTone: 'neutral',
  },
};

function response(overrides: Partial<AdminEnquiriesResponse> = {}): AdminEnquiriesResponse {
  return {
    data: [
      ROW,
      {
        ...ROW,
        id: '55555555-5555-4555-8555-555555555555',
        messagePreview: null,
        customer: { ...ROW.customer, phoneDisplay: null },
        vehicle: { ...ROW.vehicle, listingStatus: 'ACTIVE', listingStatusLabel: 'Active' },
      },
    ],
    page: { nextCursor: null, hasMore: false },
    counts: { ALL: 9, NEW: 4, CONTACTED: 3, CLOSED: 1, SPAM: 1 },
    dealer: null,
    ...overrides,
  };
}

async function listPage(params: Record<string, string> = {}) {
  return AdminEnquiriesPage({ searchParams: Promise.resolve(params) });
}

describe('/admin/enquiries', () => {
  it('reads uncached, forwarding only the filters the API understands', async () => {
    apiGetParsed.mockResolvedValue(response());
    render(
      await listPage({
        status: 'CONTACTED',
        q: '  meera ',
        dealer: 'sri',
        from: '2026-09-01',
        to: 'yesterday',
        cursor: 'abc',
      }),
    );
    expect(apiGetParsed).toHaveBeenLastCalledWith(
      expect.anything(),
      '/v1/admin/enquiries?status=CONTACTED&q=meera&dealer=sri&from=2026-09-01&cursor=abc',
      { revalidate: false },
    );

    render(await listPage({ status: 'OPEN' }));
    expect(apiGetParsed).toHaveBeenLastCalledWith(expect.anything(), '/v1/admin/enquiries', {
      revalidate: false,
    });
  });

  it('shows a tab per status with its count, and a row per enquiry', async () => {
    apiGetParsed.mockResolvedValue(response());
    render(await listPage());

    expect(screen.getByRole('heading', { name: 'Enquiries' })).toBeInTheDocument();
    expect(screen.getByText('9 enquiries')).toBeInTheDocument();
    const tabs = within(screen.getByRole('navigation', { name: 'Filter by status' }));
    expect(tabs.getByRole('link', { name: /All/ })).toHaveAttribute('aria-current', 'page');
    expect(tabs.getByRole('link', { name: /Spam/ })).toHaveAttribute(
      'href',
      '/admin/enquiries?status=SPAM',
    );

    const table = within(screen.getByRole('table'));
    expect(table.getAllByText('Meera Iyer')).toHaveLength(2);
    expect(table.getByText('+91 98400 12345')).toBeInTheDocument();
    expect(table.getByText('No number on file')).toBeInTheDocument();
    expect(table.getByText('· Listing sold')).toBeInTheDocument();
    expect(table.getByText('Asked to be contacted')).toBeInTheDocument();
    expect(table.getAllByRole('link', { name: 'View Meera Iyer’s enquiry' })[0]).toHaveAttribute(
      'href',
      `/admin/enquiries/${ID}`,
    );
    expect(table.getAllByRole('link', { name: 'Sri Lakshmi Motors' })[0]).toHaveAttribute(
      'href',
      '/admin/enquiries?dealer=sri',
    );
    expect(screen.queryByRole('link', { name: 'Show more' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('keeps the filters on every tab, on Show more, and offers to clear them', async () => {
    apiGetParsed.mockResolvedValue(
      response({
        page: { nextCursor: 'next-1', hasMore: true },
        dealer: { slug: 'sri', name: 'Sri Lakshmi Motors' },
      }),
    );
    render(await listPage({ q: 'city', dealer: 'sri', status: 'NEW' }));

    expect(screen.getByRole('link', { name: /Contacted/ })).toHaveAttribute(
      'href',
      '/admin/enquiries?status=CONTACTED&q=city&dealer=sri',
    );
    expect(screen.getByRole('link', { name: 'Show more' })).toHaveAttribute(
      'href',
      '/admin/enquiries?status=NEW&q=city&dealer=sri&cursor=next-1',
    );
    expect(screen.getByRole('link', { name: 'Clear' })).toHaveAttribute(
      'href',
      '/admin/enquiries?status=NEW',
    );
    expect(
      screen.getByRole('link', { name: 'Remove the Sri Lakshmi Motors filter' }),
    ).toHaveAttribute('href', '/admin/enquiries?status=NEW&q=city');
    expect(screen.getByRole('searchbox')).toHaveValue('city');
  });

  it('names a dealership filter nobody matches', async () => {
    apiGetParsed.mockResolvedValue(response({ data: [], dealer: { slug: 'gone', name: null } }));
    render(await listPage({ dealer: 'gone' }));
    expect(screen.getByText('No dealership “gone”')).toBeInTheDocument();
  });

  it('says there are none at all, or none matching, depending on the filters', async () => {
    apiGetParsed.mockResolvedValue(response({ data: [] }));
    const { unmount } = render(await listPage());
    expect(screen.getByText('No enquiries found')).toBeInTheDocument();
    unmount();

    render(await listPage({ status: 'SPAM' }));
    expect(screen.getByText('No enquiries match these filters')).toBeInTheDocument();
  });

  it('has a loading state', () => {
    const { unmount } = render(<AdminEnquiriesLoading />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    unmount();
    render(<AdminEnquiryLoading />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });
});

function detail(overrides: Partial<AdminEnquiryDetail> = {}): AdminEnquiryDetail {
  return {
    id: ID,
    status: 'SPAM',
    statusLabel: 'Spam',
    statusTone: 'err',
    customerStatusLabel: 'Closed',
    message: 'Is the service history available?\nI can visit on Saturday.',
    createdAt: '2026-09-26T09:02:00.000Z',
    createdLabel: '26 Sep 2026, 14:32',
    contactedLabel: '26 Sep 2026, 15:10',
    closedLabel: null,
    customer: {
      id: ROW.customer.id,
      name: 'Meera Iyer',
      phone: '+919840012345',
      phoneDisplay: '+91 98400 12345',
      phoneVerified: true,
      memberSinceLabel: '20 Sep 2026',
    },
    dealer: {
      id: ROW.dealer.id,
      name: 'Sri Lakshmi Motors',
      slug: 'sri lakshmi',
      statusLabel: 'Active',
      statusTone: 'ok',
      location: 'Katpadi, Vellore',
      phoneDisplay: '+91 94430 00000',
      adminHref: `/admin/dealers/${ROW.dealer.id}`,
    },
    vehicle: {
      ...ROW.vehicle,
      image: { url: 'https://media.test/by-media/x/640.webp', alt: 'Photograph of the car' },
      publicHref: null,
      adminHref: `/admin/listings/${ROW.vehicle.listingId}`,
    },
    history: [
      {
        action: 'enquiry.created',
        label: 'Enquiry sent',
        actor: 'Customer',
        fromStatus: null,
        toStatus: 'NEW',
        at: '2026-09-26T09:02:00.000Z',
        atLabel: '26 Sep 2026, 14:32',
      },
      {
        action: 'enquiry.spam',
        label: 'Marked as spam',
        actor: 'Dealer',
        fromStatus: 'NEW',
        toStatus: 'SPAM',
        at: '2026-09-26T10:00:00.000Z',
        atLabel: '26 Sep 2026, 15:30',
      },
    ],
    ...overrides,
  };
}

describe('/admin/enquiries/[id]', () => {
  it('reads uncached and shows the customer, the car, the dealer and the history', async () => {
    apiGetParsed.mockResolvedValue(detail());
    render(await AdminEnquiryPage({ params: Promise.resolve({ id: ID }) }));
    expect(apiGetParsed).toHaveBeenLastCalledWith(expect.anything(), `/v1/admin/enquiries/${ID}`, {
      revalidate: false,
    });

    expect(screen.getByRole('heading', { name: 'Enquiry from Meera Iyer' })).toBeInTheDocument();
    expect(screen.getByText(/I can visit on Saturday/)).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Photograph of the car' })).toBeInTheDocument();
    expect(screen.getByText('Not on the marketplace now')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open listing review' })).toHaveAttribute(
      'href',
      `/admin/listings/${ROW.vehicle.listingId}`,
    );
    expect(screen.getByRole('link', { name: 'Open dealer' })).toHaveAttribute(
      'href',
      `/admin/dealers/${ROW.dealer.id}`,
    );
    expect(screen.getByRole('link', { name: 'All their enquiries' })).toHaveAttribute(
      'href',
      '/admin/enquiries?dealer=sri%20lakshmi',
    );
    const history = within(screen.getByRole('list'));
    expect(history.getByText('Marked as spam')).toBeInTheDocument();
    expect(history.getByText(/New → Spam · by Dealer/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says what is missing rather than leaving it blank', async () => {
    apiGetParsed.mockResolvedValue(
      detail({
        message: null,
        contactedLabel: null,
        closedLabel: '27 Sep 2026, 10:00',
        history: [],
        customer: { ...detail().customer, phone: null, phoneDisplay: null, phoneVerified: false },
        dealer: { ...detail().dealer, location: null, phoneDisplay: null },
        vehicle: { ...detail().vehicle, image: null, publicHref: '/car/a-car' },
      }),
    );
    render(await AdminEnquiryPage({ params: Promise.resolve({ id: ID }) }));

    expect(
      screen.getByText('No message — the customer asked to be contacted.'),
    ).toBeInTheDocument();
    expect(screen.getByText('No number on file')).toBeInTheDocument();
    expect(screen.getAllByText('Not entered')).toHaveLength(2);
    expect(screen.getByText('No photograph yet')).toBeInTheDocument();
    expect(screen.getByText('No recorded history for this enquiry.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View on Dealers-Drive' })).toHaveAttribute(
      'href',
      '/car/a-car',
    );
  });

  it('answers an unknown enquiry with the 404 page, and passes anything else on', async () => {
    const { ApiError } = await import('@/lib/api');
    apiGetParsed.mockRejectedValue(
      new ApiError({ type: 'x', title: 'Not found', status: 404, code: 'ENQUIRY_NOT_FOUND' }),
    );
    await expect(AdminEnquiryPage({ params: Promise.resolve({ id: ID }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );

    apiGetParsed.mockRejectedValue(new Error('boom'));
    await expect(AdminEnquiryPage({ params: Promise.resolve({ id: ID }) })).rejects.toThrow('boom');
  });
});
