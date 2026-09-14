import type { AdminOverview } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type * as ApiModule from '@/lib/api';
import { ADMIN_NAV, LANDED_ADMIN_NAV } from '@/components/admin/admin-nav';
import AdminDashboardPage from '@/app/(admin)/admin/page';

/**
 * `/admin` (**F048**), and the nav that finally points at something.
 *
 * The shell has existed since F049 with no page under it: `/admin` was a 404
 * that the sidebar's own first item linked to, and the console could only be
 * entered by typing `/admin/dealers`.
 *
 * As on the dealer side, the claim is that the page computes nothing. Whether a
 * stat box is a link is the **API's** decision, carried on `href`, not a rule
 * this component holds — which is what keeps the grid honest while five of the
 * six counters have no screen to link to.
 */
const apiGet = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiGet: (path: string) => apiGet(path) as unknown,
}));

function overview(overrides: Partial<AdminOverview> = {}): AdminOverview {
  return {
    stats: [
      { key: 'totalDealers', label: 'Total dealers', value: 12, valueLabel: '12' },
      {
        key: 'pendingVerification',
        label: 'Pending verification',
        value: 3,
        valueLabel: '3',
        href: '/admin/dealers?status=PENDING_APPROVAL',
      },
      { key: 'activeListings', label: 'Active listings', value: 0, valueLabel: '0' },
      { key: 'payments30d', label: 'Payments (30d)', value: 0, valueLabel: '₹0' },
      { key: 'revenue30d', label: 'Revenue (30d)', value: 0, valueLabel: '₹0' },
      { key: 'newEnquiries', label: 'New enquiries', value: 0, valueLabel: '0' },
    ],
    moderationQueue: {
      pendingCount: 0,
      oldestWaitingLabel: '—',
      message: 'No listings are waiting for review.',
      href: '/admin/listings',
    },
    headerBadge: { count: 0, label: '0 awaiting review', tone: 'neutral' },
    operator: { email: 'ops@dealers-drive.com', adminRole: 'SUPER_ADMIN' },
    ...overrides,
  };
}

async function renderPage(payload: AdminOverview = overview()) {
  apiGet.mockResolvedValue(payload);
  render(await AdminDashboardPage());
}

describe('the overview screen', () => {
  it('reads the same overview the layout does', async () => {
    await renderPage();

    expect(apiGet).toHaveBeenCalledWith('/v1/admin/metrics/overview');
  });

  it('renders six stat boxes with the API’s own labels', async () => {
    await renderPage();

    expect(screen.getByText('Total dealers')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    // ₹0 rather than 0 — the rupee formatting is the service's.
    expect(screen.getAllByText('₹0')).toHaveLength(2);
  });

  /**
   * The honest half of the grid. `pendingVerification` points at
   * `/admin/dealers`, which exists; the five counters whose screens have not
   * landed carry no `href` and are therefore plain boxes rather than links onto
   * a 404. The page never decides this — it renders what it is handed.
   */
  it('links only the boxes the API gave an href', async () => {
    await renderPage();

    const links = screen.getAllByRole('link');

    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/admin/dealers?status=PENDING_APPROVAL');
  });

  it('links a box the moment the API starts sending an href for it', async () => {
    await renderPage(
      overview({
        stats: [
          {
            key: 'activeListings',
            label: 'Active listings',
            value: 4,
            valueLabel: '4',
            href: '/admin/listings',
          },
        ],
      }),
    );

    expect(screen.getByRole('link', { name: /Active listings/ })).toHaveAttribute(
      'href',
      '/admin/listings',
    );
  });
});

describe('the moderation panel', () => {
  it('prints the queue message the API composed', async () => {
    await renderPage();

    expect(screen.getByText('No listings are waiting for review.')).toBeInTheDocument();
  });

  /**
   * ── Reconstruction slice ──────────────────────────────────────────────────
   * The baseline's `Open queue →` ghost sits in this heading row, onto
   * `moderationQueue.href` — `/admin/listings`, which is **F069**. Held back
   * rather than pointed at a 404; this case is what should fail when F069
   * restores it.
   * ──────────────────────────────────────────────────────────────────────────
   */
  it('offers no way into a queue screen that does not exist', async () => {
    await renderPage();

    const panel = screen.getByRole('heading', { name: 'Moderation queue' }).closest('section');
    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).queryByRole('link')).toBeNull();
  });
});

/**
 * The sidebar, and the reason this feature touched it.
 *
 * `ADMIN_NAV` is the baseline's five items. Two of their routes — `/admin/
 * listings` (F069) and `/admin/payments` (F053) — do not exist, and were
 * offered anyway from F049 until now: two of the five items in a cross-tenant
 * operations console led to a 404. `console-nav.tsx` has never done that on the
 * dealer side, and this applies the same rule.
 *
 * As there, the assertion is not "there are exactly three items" — F053 and
 * F069 each add one, and a test two unrelated features have to edit is a test
 * people stop reading.
 */
describe('the admin nav', () => {
  it('offers only routes that exist', () => {
    expect(LANDED_ADMIN_NAV.every((item) => ADMIN_NAV.includes(item))).toBe(true);
    expect(LANDED_ADMIN_NAV.map((item) => item.href)).not.toContain('/admin/listings');
    expect(LANDED_ADMIN_NAV.map((item) => item.href)).not.toContain('/admin/payments');
  });

  /** **F048.** The first item finally points at a page. */
  it('offers the dashboard, the dealers list and the settings screen', () => {
    expect(LANDED_ADMIN_NAV.map((item) => item.href)).toEqual([
      '/admin',
      '/admin/dealers',
      '/admin/config',
    ]);
  });
});
