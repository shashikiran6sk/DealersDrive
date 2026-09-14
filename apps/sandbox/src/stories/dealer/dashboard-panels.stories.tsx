import type { DashboardResponse } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { RecentEnquiries, ViewsChart } from '@/components/dealer/dashboard-panels';

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

export const Chart: Story = {};

export const ChartWithNoViews: Story = {
  args: { chart: chart([0, 0, 0, 0, 0, 0, 0]) },
};

export const ChartWithOneSpike: Story = {
  args: { chart: chart([4, 2, 0, 900, 6, 3, 1]) },
};

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

export const Enquiries: StoryObj<typeof RecentEnquiries> = {
  render: () => <RecentEnquiries enquiries={ENQUIRIES} />,
};

export const NoEnquiriesYet: StoryObj<typeof RecentEnquiries> = {
  render: () => <RecentEnquiries enquiries={[]} />,
};

export const GeneralEnquiry: StoryObj<typeof RecentEnquiries> = {
  render: () => <RecentEnquiries enquiries={[ENQUIRIES[1]!]} />,
};

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
