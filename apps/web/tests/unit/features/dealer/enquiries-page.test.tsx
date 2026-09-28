import type { DealerEnquiriesResponse, DealerEnquiry } from '@dealers-drive/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EnquiriesPage from '@/app/(dealer)/dealer/enquiries/page';
import { setEnquiryStatusAction } from '@/features/dealer/enquiry-actions';
import type * as ApiModule from '@/lib/api';

/**
 * The dealership's inbox (**R66**). The page is a server component reading
 * `GET /v1/dealer/enquiries` uncached; the only client code is the row of
 * status buttons, which calls a Server Action and lets the revalidated page
 * redraw. These pin what a dealer is shown and what each button sends.
 */
const apiGetParsed = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return { ...actual, apiGetParsed: (...args: unknown[]) => apiGetParsed(...args) as unknown };
});

vi.mock('@/features/dealer/enquiry-actions', () => ({ setEnquiryStatusAction: vi.fn() }));

const RAVI: DealerEnquiry = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'NEW',
  statusLabel: 'New',
  statusTone: 'accent',
  message: 'Is the price negotiable?',
  createdAt: '2026-09-28T10:30:00.000Z',
  createdLabel: '28 Sep 2026',
  timeAgoLabel: '18 min ago',
  contactedAt: null,
  closedAt: null,
  customer: {
    name: 'Ravi Kumar',
    initials: 'RK',
    phone: '+919840012345',
    phoneDisplay: '+91 98400 12345',
    callHref: 'tel:+919840012345',
  },
  vehicle: {
    id: '22222222-2222-4222-8222-222222222222',
    title: '2023 Hyundai Creta SX(O)',
    registrationDisplay: 'TN 23 AB 1234',
    listingStatus: 'ACTIVE',
    href: '/car/2023-hyundai-creta-sx-o',
  },
};

function inbox(overrides: Partial<DealerEnquiriesResponse> = {}): DealerEnquiriesResponse {
  return {
    data: [RAVI],
    page: { nextCursor: null, hasMore: false },
    counts: { ALL: 5, NEW: 2, CONTACTED: 1, CLOSED: 1, SPAM: 1 },
    ...overrides,
  };
}

async function page(params: Record<string, string> = {}) {
  return EnquiriesPage({ searchParams: Promise.resolve(params) });
}

beforeEach(() => {
  apiGetParsed.mockReset();
  vi.mocked(setEnquiryStatusAction).mockReset();
});

describe('/dealer/enquiries', () => {
  it('opens on the New tab, reading the inbox uncached', async () => {
    apiGetParsed.mockResolvedValue(inbox());
    render(await page());

    expect(apiGetParsed).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/dealer/enquiries?status=NEW',
      { revalidate: false },
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Enquiries' })).toBeInTheDocument();
  });

  it('passes a known tab and a cursor, and nothing else', async () => {
    apiGetParsed.mockResolvedValue(inbox());
    render(await page({ status: 'SPAM', cursor: 'abc', dealerId: 'x' }));

    expect(apiGetParsed).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/dealer/enquiries?status=SPAM&cursor=abc',
      { revalidate: false },
    );
  });

  it('falls back to New for a tab it does not know', async () => {
    apiGetParsed.mockResolvedValue(inbox());
    render(await page({ status: 'OPEN' }));

    expect(apiGetParsed).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/dealer/enquiries?status=NEW',
      { revalidate: false },
    );
  });

  it('shows the four tabs with their counts, and marks the current one', async () => {
    apiGetParsed.mockResolvedValue(inbox());
    render(await page({ status: 'CONTACTED' }));

    const tabs = within(screen.getByRole('navigation', { name: 'Filter by status' }));
    expect(tabs.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'New2',
      'Contacted1',
      'Closed1',
      'Spam1',
    ]);
    expect(tabs.getByRole('link', { name: /Contacted/ })).toHaveAttribute('aria-current', 'page');
    expect(tabs.getByRole('link', { name: /Spam/ })).toHaveAttribute(
      'href',
      '/dealer/enquiries?status=SPAM',
    );
    expect(screen.getByText('5 enquiries')).toBeInTheDocument();
  });
});

describe('an enquiry', () => {
  it('shows who, their verified number to call, which car and what they asked', async () => {
    apiGetParsed.mockResolvedValue(inbox());
    render(await page());

    const card = within(screen.getByRole('listitem'));
    expect(card.getByText('Ravi Kumar')).toBeInTheDocument();
    expect(card.getByText('+91 98400 12345')).toBeInTheDocument();
    expect(card.getByText('Verified')).toBeInTheDocument();
    expect(card.getByRole('link', { name: 'Call +91 98400 12345' })).toHaveAttribute(
      'href',
      'tel:+919840012345',
    );
    expect(card.getByRole('link', { name: '2023 Hyundai Creta SX(O)' })).toHaveAttribute(
      'href',
      '/car/2023-hyundai-creta-sx-o',
    );
    expect(card.getByText('Is the price negotiable?')).toBeInTheDocument();
    expect(card.getByText('18 min ago')).toHaveAttribute('datetime', '2026-09-28T10:30:00.000Z');
  });

  it('names the car without a link once it is off the marketplace, and says when nothing was written', async () => {
    apiGetParsed.mockResolvedValue(
      inbox({
        data: [
          {
            ...RAVI,
            message: null,
            vehicle: { ...RAVI.vehicle, listingStatus: 'SOLD', href: null },
          },
        ],
      }),
    );
    render(await page());

    expect(screen.queryByRole('link', { name: '2023 Hyundai Creta SX(O)' })).toBeNull();
    expect(screen.getByText('2023 Hyundai Creta SX(O)')).toBeInTheDocument();
    expect(screen.getByText('Asked to be contacted.')).toBeInTheDocument();
  });

  it('offers no Call button for an account whose number is gone', async () => {
    apiGetParsed.mockResolvedValue(
      inbox({
        data: [
          {
            ...RAVI,
            customer: { ...RAVI.customer, phone: null, phoneDisplay: null, callHref: null },
          },
        ],
      }),
    );
    render(await page());

    expect(screen.queryByRole('link', { name: /^Call/ })).toBeNull();
    expect(screen.getByText('Number no longer on file')).toBeInTheDocument();
  });

  it.each([
    ['NEW', ['Mark contacted', 'Close', 'Spam']],
    ['CONTACTED', ['Close', 'Spam']],
    ['CLOSED', ['Reopen']],
    ['SPAM', ['Not spam']],
  ] as const)('offers the moves that make sense from %s', async (status, labels) => {
    apiGetParsed.mockResolvedValue(inbox({ data: [{ ...RAVI, status }] }));
    render(await page({ status }));

    const group = within(screen.getByRole('group', { name: 'Actions for Ravi Kumar’s enquiry' }));
    expect(group.getAllByRole('button').map((button) => button.textContent)).toEqual([...labels]);
  });

  it('sends the move for this enquiry, and nothing about the customer', async () => {
    const user = userEvent.setup();
    vi.mocked(setEnquiryStatusAction).mockResolvedValue({ ok: true });
    apiGetParsed.mockResolvedValue(inbox());
    render(await page());

    await user.click(screen.getByRole('button', { name: 'Mark contacted' }));

    await waitFor(() => {
      expect(setEnquiryStatusAction).toHaveBeenCalledWith(RAVI.id, 'CONTACTED');
    });
  });

  it('says so when the move is refused', async () => {
    const user = userEvent.setup();
    vi.mocked(setEnquiryStatusAction).mockResolvedValue({
      ok: false,
      message: 'That enquiry is not in your inbox.',
    });
    apiGetParsed.mockResolvedValue(inbox());
    render(await page());

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That enquiry is not in your inbox.',
    );
  });
});

describe('an empty tab, and more than one page', () => {
  it('says what the tab is for when it is empty', async () => {
    apiGetParsed.mockResolvedValue(inbox({ data: [] }));
    render(await page({ status: 'SPAM' }));

    expect(screen.getByText('No spam')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('links to the next page of the same tab', async () => {
    apiGetParsed.mockResolvedValue(inbox({ page: { nextCursor: 'next', hasMore: true } }));
    render(await page({ status: 'CLOSED' }));

    expect(screen.getByRole('link', { name: 'Show more' })).toHaveAttribute(
      'href',
      '/dealer/enquiries?status=CLOSED&cursor=next',
    );
  });
});
