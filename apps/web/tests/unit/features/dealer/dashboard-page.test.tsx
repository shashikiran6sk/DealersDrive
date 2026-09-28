import type { DashboardResponse } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type * as ApiModule from '@/lib/api';
import DealerDashboardPage from '@/app/(dealer)/dealer/page';

/**
 * What `/dealer` renders (**F048**).
 *
 * **The claim this file exists to hold is that the page does no arithmetic.**
 * Every number on §3.12 arrives formatted from C18 — the greeting, the four
 * deltas, the bar heights and the relative times — so the tests feed the
 * component values that are deliberately *inconsistent* with each other and
 * assert that what appears on screen is what the API said, not what a
 * recomputation would produce. A page that quietly derived its own bar height
 * would fail these and pass a fixture where the numbers agreed.
 *
 * The guard is the layout's, not this page's, and lives in
 * `console-layout.test.tsx`.
 */
const apiGet = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiGet: (path: string) => apiGet(path) as unknown,
}));

function dashboard(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    greeting: 'Good evening, Kumar',
    subline: 'Here is what happened across your inventory in the last 7 days.',
    stats: [
      {
        key: 'activeListings',
        label: 'Active listings',
        value: 7,
        valueLabel: '7',
        delta: 'No change this week',
        deltaTone: 'neutral',
      },
      {
        key: 'credits',
        label: 'Available credits',
        value: 12500,
        valueLabel: '12,500',
        delta: '4 used this month',
        deltaTone: 'neutral',
      },
      {
        key: 'newEnquiries',
        label: 'New enquiries',
        value: 3,
        valueLabel: '3',
        delta: 'First week of enquiries',
        deltaTone: 'ok',
      },
      {
        key: 'views',
        label: 'Vehicle views',
        value: 1500,
        valueLabel: '1,500',
        delta: '+50% vs last week',
        deltaTone: 'ok',
      },
    ],
    listingStats: [
      {
        key: 'ACTIVE',
        label: 'Active listings',
        value: 4,
        href: '/dealer/inventory?status=ACTIVE',
        tone: 'ok',
      },
      {
        key: 'RESERVED',
        label: 'Reserved',
        value: 1,
        href: '/dealer/inventory?status=RESERVED',
        tone: 'warn',
      },
      {
        key: 'PENDING_REVIEW',
        label: 'Pending review',
        value: 2,
        href: '/dealer/inventory?status=PENDING_REVIEW',
        tone: 'warn',
      },
      {
        key: 'CHANGES_REQUESTED',
        label: 'Changes requested',
        value: 1,
        href: '/dealer/inventory?status=CHANGES_REQUESTED',
        tone: 'warn',
      },
      {
        key: 'SOLD',
        label: 'Sold',
        value: 9,
        href: '/dealer/inventory?status=SOLD',
        tone: 'accent',
      },
    ],
    viewsChart: {
      title: 'Views this week',
      totalLabel: '1,500 total',
      max: 40,
      series: [
        { day: 'Mon', date: '2026-08-11', views: 0, heightPct: 0 },
        { day: 'Tue', date: '2026-08-12', views: 10, heightPct: 25 },
        { day: 'Wed', date: '2026-08-13', views: 0, heightPct: 0 },
        { day: 'Thu', date: '2026-08-14', views: 0, heightPct: 0 },
        { day: 'Fri', date: '2026-08-15', views: 0, heightPct: 0 },
        { day: 'Sat', date: '2026-08-16', views: 0, heightPct: 0 },
        { day: 'Sun', date: '2026-08-17', views: 40, heightPct: 100 },
      ],
    },
    recentEnquiries: [],
    creditBalance: 12500,
    creditsHeld: 2,
    alerts: [],
    ...overrides,
  };
}

async function renderPage(payload: DashboardResponse = dashboard()) {
  apiGet.mockResolvedValue(payload);
  render(await DealerDashboardPage());
}

describe('what it reads', () => {
  it('reads the dashboard, and nothing else', async () => {
    await renderPage();

    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(apiGet).toHaveBeenCalledWith('/v1/dealer/dashboard');
  });
});

describe('every number is the API’s', () => {
  it('prints the greeting and subline verbatim', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { name: 'Good evening, Kumar' })).toBeInTheDocument();
    expect(screen.getByText(/last 7 days/)).toBeInTheDocument();
  });

  it('renders each stat with the label the API formatted, not the raw value', async () => {
    await renderPage();

    // `12,500` rather than `12500` — the Indian grouping is applied server-side.
    expect(screen.getByText('12,500')).toBeInTheDocument();
    expect(screen.getByText('4 used this month')).toBeInTheDocument();
    expect(screen.getByText('First week of enquiries')).toBeInTheDocument();
    expect(screen.getByText('+50% vs last week')).toBeInTheDocument();
  });

  /**
   * The sharp end of it. `heightPct` is computed against the week's own maximum
   * by the service, so the bar drawn and the total printed beside it come from
   * one calculation. Here the payload is deliberately inconsistent — a 10-view
   * day at 25% against a `totalLabel` that does not match the series sum — and
   * the page must render both as given.
   */
  it('draws each bar at the height the API sent', async () => {
    await renderPage();

    const bars = screen.getAllByRole('img');

    expect(bars).toHaveLength(7);
    expect(bars[6]).toHaveStyle({ height: '100%' });
    expect(bars[1]).toHaveStyle({ height: '25%' });
    expect(bars[0]).toHaveStyle({ height: '0%' });
  });

  /**
   * A chart is the one place the information is entirely in the geometry:
   * seven unlabelled boxes tell a screen reader nothing at all.
   */
  it('labels every bar with its day and count', async () => {
    await renderPage();

    expect(screen.getByLabelText('Sun: 40 views')).toBeInTheDocument();
    expect(screen.getByLabelText('Mon: 0 views')).toBeInTheDocument();
  });

  it('prints the chart total the API formatted', async () => {
    await renderPage();

    expect(screen.getByText('1,500 total')).toBeInTheDocument();
  });
});

describe('the alerts', () => {
  it('renders none when the API sends none', async () => {
    await renderPage();

    expect(screen.queryByText(/expire/)).not.toBeInTheDocument();
  });

  it('renders one per alert, with the API’s own message and link', async () => {
    await renderPage(
      dashboard({
        alerts: [
          {
            type: 'EXPIRING_SOON',
            count: 3,
            message: '3 listings expire in the next 7 days.',
            href: '/dealer/inventory?status=ACTIVE',
          },
        ],
      }),
    );

    expect(screen.getByText('3 listings expire in the next 7 days.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '/dealer/inventory?status=ACTIVE',
    );
  });
});

describe('recent enquiries', () => {
  /**
   * The state every new dealership sees. It says where leads will appear
   * rather than leaving an empty panel.
   */
  it('says where leads will appear when there are none', async () => {
    await renderPage();

    expect(screen.getByText(/the moment a buyer taps Enquire or Call/)).toBeInTheDocument();
  });

  it('gives each lead a one-tap call with the number in its label', async () => {
    await renderPage(
      dashboard({
        recentEnquiries: [
          {
            id: '7f3c9a21-1111-4000-8000-000000000001',
            initials: 'AR',
            name: 'Anitha R',
            vehicleTitle: '2021 Maruti Suzuki Alto 800 VXI',
            phoneDisplay: '+91 98765 43210',
            callHref: 'tel:9876543210',
            timeAgoLabel: '1 hour ago',
          },
        ],
      }),
    );

    const call = screen.getByRole('link', { name: 'Call Anitha R on +91 98765 43210' });
    expect(call).toHaveAttribute('href', 'tel:9876543210');
    expect(screen.getByText('2021 Maruti Suzuki Alto 800 VXI')).toBeInTheDocument();
  });

  /** A lead is a lead, whether or not it is about a particular car. */
  it('labels an enquiry with no vehicle rather than dropping it', async () => {
    await renderPage(
      dashboard({
        recentEnquiries: [
          {
            id: '7f3c9a21-1111-4000-8000-000000000002',
            initials: 'SK',
            name: 'Suresh K',
            vehicleTitle: null,
            phoneDisplay: '+91 98765 43211',
            callHref: 'tel:9876543211',
            timeAgoLabel: '2 hours ago',
          },
        ],
      }),
    );

    expect(screen.getByText('General enquiry')).toBeInTheDocument();
  });

  /** **R67.** A lead whose number has since been released has nothing to dial. */
  it('offers no call for an enquiry with no number on file', async () => {
    await renderPage(
      dashboard({
        recentEnquiries: [
          {
            id: '7f3c9a21-1111-4000-8000-000000000003',
            initials: 'CU',
            name: 'Customer',
            vehicleTitle: '2021 Tata Nexon',
            phoneDisplay: null,
            callHref: null,
            timeAgoLabel: '3 hours ago',
          },
        ],
      }),
    );

    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Call/ })).toBeNull();
  });

  /**
   * The baseline's panel heading carries an `All enquiries →` ghost button onto
   * `/dealer/enquiries`. It was held back until the inbox existed (R66), and
   * comes back with R67.
   */
  it('links to the enquiries screen', async () => {
    await renderPage();

    const panel = screen.getByRole('heading', { name: 'Recent enquiries' }).closest('section');
    expect(panel).not.toBeNull();
    expect(
      within(panel as HTMLElement).getByRole('link', { name: 'All enquiries →' }),
    ).toHaveAttribute('href', '/dealer/enquiries');
  });
});

describe('the vehicle counts (F066)', () => {
  it('shows the four listing states, each linking to its inventory tab, and the Add vehicle CTA', async () => {
    apiGet.mockResolvedValue(dashboard());
    render(await DealerDashboardPage());

    const nav = screen.getByRole('navigation', { name: /vehicles by status/i });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/dealer/inventory?status=ACTIVE',
      '/dealer/inventory?status=RESERVED',
      '/dealer/inventory?status=PENDING_REVIEW',
      '/dealer/inventory?status=CHANGES_REQUESTED',
      '/dealer/inventory?status=SOLD',
    ]);
    expect(within(nav).getByText('Changes requested')).toBeInTheDocument();
    expect(within(nav).getByText('Reserved')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+ Add vehicle' })).toHaveAttribute(
      'href',
      '/dealer/vehicles/new',
    );
  });
});
