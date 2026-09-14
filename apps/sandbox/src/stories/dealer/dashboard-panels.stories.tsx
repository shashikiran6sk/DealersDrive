import type { DashboardResponse } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { RecentEnquiries, ViewsChart } from '@/components/dealer/dashboard-panels';

/**
 * DESIGN-SPEC §3.12 — the dashboard's two panels (C077, C078), from **F048**.
 *
 * **`ViewsChart` computes nothing.** The bar heights are `heightPct` on the
 * payload, scaled server-side against the week's own maximum, so the drawing
 * and the total printed above it come from one calculation and cannot drift
 * apart. The stories below exploit that: several of them pass heights that a
 * component deriving its own ratio would render differently, which is the
 * fastest way to see by eye whether it is obeying the API.
 *
 * The states worth looking at are the degenerate ones — a week with no traffic
 * at all, a single spike that flattens everything else, and a panel with no
 * leads — because those are what a new dealership sees and what the product
 * looks like on the day it launches.
 */
function series(views: number[]): DashboardResponse['viewsChart']['series'] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const max = Math.max(1, ...views);
  return views.map((count, index) => ({
    day: days[index] ?? '—',
    date: `2026-08-${String(11 + index).padStart(2, '0')}`,
    views: count,
    heightPct: Math.round((count / max) * 100),
  }));
}

function chart(views: number[]): DashboardResponse['viewsChart'] {
  const points = series(views);
  const total = views.reduce((sum, count) => sum + count, 0);
  return {
    title: 'Views this week',
    totalLabel: `${total.toLocaleString('en-IN')} total`,
    max: Math.max(1, ...views),
    series: points,
  };
}

const meta = {
  title: 'Dealer/DashboardPanels',
  component: ViewsChart,
  args: { chart: chart([120, 180, 90, 240, 310, 260, 300]) },
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ViewsChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An ordinary week. */
export const Chart: Story = {};

/**
 * **A quiet week, which is exactly the week a dealer looks at.** Every bar is
 * zero; the service floors `max` at 1 so this renders flat rather than `NaN%`,
 * and the day labels still show all seven days — a chart with three bars
 * because three days had traffic is a chart that lies about the week.
 */
export const ChartWithNoViews: Story = {
  args: { chart: chart([0, 0, 0, 0, 0, 0, 0]) },
};

/**
 * One day carrying the week. Everything else is scaled against it and becomes
 * a hairline — worth seeing, because it is what a dealer gets after one car is
 * shared somewhere.
 */
export const ChartWithOneSpike: Story = {
  args: { chart: chart([4, 2, 0, 900, 6, 3, 1]) },
};

/** A first day of trading: six empty days and one bar. */
export const ChartOnTheFirstDay: Story = {
  args: { chart: chart([0, 0, 0, 0, 0, 0, 18]) },
};

const ENQUIRIES: DashboardResponse['recentEnquiries'] = [
  {
    id: '7f3c9a21-1111-4000-8000-000000000001',
    initials: 'AR',
    name: 'Anitha R',
    vehicleTitle: '2021 Maruti Suzuki Alto 800 VXI',
    phoneDisplay: '+91 98765 43210',
    callHref: 'tel:9876543210',
    timeAgoLabel: '1 hour ago',
  },
  {
    id: '7f3c9a21-1111-4000-8000-000000000002',
    initials: 'SK',
    name: 'Suresh Kumaravel',
    vehicleTitle: null,
    phoneDisplay: '+91 98765 43211',
    callHref: 'tel:9876543211',
    timeAgoLabel: '3 hours ago',
  },
  {
    id: '7f3c9a21-1111-4000-8000-000000000003',
    initials: 'PV',
    name: 'Priya Venkatesan',
    vehicleTitle: '2019 Hyundai Grand i10 Nios Sportz',
    phoneDisplay: '+91 98765 43212',
    callHref: 'tel:9876543212',
    timeAgoLabel: 'Yesterday',
  },
  {
    id: '7f3c9a21-1111-4000-8000-000000000004',
    initials: 'MB',
    name: 'Mohammed Basheer',
    vehicleTitle: '2018 Honda City ZX CVT Petrol',
    phoneDisplay: '+91 98765 43213',
    callHref: 'tel:9876543213',
    timeAgoLabel: '2 days ago',
  },
];

/** Four leads, each one tap from a call. */
export const Enquiries: StoryObj<typeof RecentEnquiries> = {
  render: () => <RecentEnquiries enquiries={ENQUIRIES} />,
};

/**
 * **What every dealership sees on day one**, and — until `Enquiry` lands at
 * F088 — the only state the API can produce. The sentence is the panel's whole
 * job here: it says where leads will appear rather than leaving a blank box.
 */
export const NoEnquiriesYet: StoryObj<typeof RecentEnquiries> = {
  render: () => <RecentEnquiries enquiries={[]} />,
};

/**
 * A general enquiry — somebody asking the dealership a question rather than
 * asking about one car. The row is kept and labelled rather than dropped.
 */
export const GeneralEnquiry: StoryObj<typeof RecentEnquiries> = {
  render: () => <RecentEnquiries enquiries={[ENQUIRIES[1]!]} />,
};

/**
 * A long name against a long vehicle title, at the width the panel actually
 * gets on a phone. The title ellipsises; the name does not, and the `Call`
 * button must not be pushed off the row.
 */
export const LongNamesAtPhoneWidth: StoryObj<typeof RecentEnquiries> = {
  render: () => (
    <div style={{ maxWidth: 330 }}>
      <RecentEnquiries
        enquiries={[
          {
            ...ENQUIRIES[3]!,
            name: 'Mohammed Basheer Abdul Rahman',
            vehicleTitle: '2018 Honda City ZX CVT Petrol Anniversary Edition',
          },
        ]}
      />
    </div>
  ),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
