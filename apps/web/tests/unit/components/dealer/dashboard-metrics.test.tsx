import type { DashboardResponse } from '@dealers-drive/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardMetrics } from '@/components/dealer/dashboard-metrics';

const stats: DashboardResponse['stats'] = [
  {
    key: 'credits',
    label: 'Available credits',
    value: 100,
    valueLabel: '100',
    delta: 'Unused',
    deltaTone: 'neutral',
  },
  {
    key: 'views',
    label: 'Vehicle views',
    value: 9,
    valueLabel: '1,234',
    delta: '+8% vs last week',
    deltaTone: 'ok',
  },
  {
    key: 'activeListings',
    label: 'Active listings',
    value: 1,
    valueLabel: '07',
    delta: 'No change this week',
    deltaTone: 'neutral',
  },
  {
    key: 'newEnquiries',
    label: 'New enquiries',
    value: 2,
    valueLabel: '03',
    delta: 'First week of enquiries',
    deltaTone: 'ok',
  },
];
const listingStats: DashboardResponse['listingStats'] = [
  {
    key: 'ACTIVE',
    label: 'Duplicate active count',
    value: 99,
    href: '/dealer/inventory?status=ACTIVE',
    tone: 'ok',
  },
  {
    key: 'RESERVED',
    label: 'Reserved',
    value: 12,
    href: '/dealer/inventory?status=RESERVED',
    tone: 'warn',
  },
  {
    key: 'PENDING_REVIEW',
    label: 'Pending review',
    value: 5,
    href: '/dealer/inventory?status=PENDING_REVIEW&page=2',
    tone: 'warn',
  },
  { key: 'SOLD', label: 'Sold', value: 42, href: '/dealer/inventory?status=SOLD', tone: 'neutral' },
];

describe('DashboardMetrics', () => {
  it('selects four metrics in order and preserves independently formatted API values and deltas', () => {
    render(<DashboardMetrics stats={stats} listingStats={listingStats} />);
    const region = screen.getByRole('region', { name: 'Dashboard overview' });
    expect(region.children).toHaveLength(4);
    expect(Array.from(region.children).map((node) => node.textContent)).toEqual([
      'Active listings07No change this week',
      'Pending review5',
      'New enquiries03First week of enquiries',
      'Vehicle views1,234+8% vs last week',
    ]);
    expect(within(region).queryByText('Available credits')).not.toBeInTheDocument();
    expect(within(region).queryByText('Duplicate active count')).not.toBeInTheDocument();
    expect(within(region).queryByText('Reserved')).not.toBeInTheDocument();
    expect(within(region).queryByText('Sold')).not.toBeInTheDocument();
    expect(within(region).getByRole('link', { name: /Pending review/ })).toHaveAttribute(
      'href',
      listingStats[2]!.href,
    );
  });

  it('reports missing metrics as unavailable instead of inventing zeroes', () => {
    render(<DashboardMetrics stats={[]} listingStats={[]} />);
    expect(screen.getAllByText('Unavailable')).toHaveLength(4);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows four honest loading placeholders before replacing them with the supplied metrics', () => {
    const view = render(<DashboardMetrics loading />);
    const status = screen.getByRole('status', { name: 'Loading dashboard metrics' });
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status.children).toHaveLength(4);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    view.rerender(<DashboardMetrics stats={stats} listingStats={listingStats} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });
});
