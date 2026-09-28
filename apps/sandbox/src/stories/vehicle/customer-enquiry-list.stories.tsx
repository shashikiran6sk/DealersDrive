import type { CustomerEnquiriesResponse, CustomerEnquiry } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CustomerEnquiryList } from '@/features/enquiry/customer-enquiries';

function enquiry(n: number, overrides: Partial<CustomerEnquiry> = {}): CustomerEnquiry {
  return {
    id: `0000000${String(n)}-2222-4222-8222-222222222222`,
    status: 'SENT',
    statusLabel: 'Sent',
    statusTone: 'accent',
    message: 'Is the price negotiable? I can come on Saturday morning.',
    createdAt: '2026-09-28T10:30:00.000Z',
    createdLabel: '28 Sep 2026',
    dealerName: 'Sri Lakshmi Motors',
    vehicle: { title: '2023 Hyundai Creta SX(O)', href: '/car/2023-hyundai-creta-sx-o' },
    ...overrides,
  };
}

const EVERY_STATE: CustomerEnquiry[] = [
  enquiry(1),
  enquiry(2, {
    status: 'CONTACTED',
    statusLabel: 'Contacted',
    statusTone: 'ok',
    message: null,
    createdLabel: '25 Sep 2026',
    dealerName: 'Vellore Car Bazaar',
    vehicle: { title: '2021 Tata Nexon XZ+', href: '/car/2021-tata-nexon-xz-plus' },
  }),
  enquiry(3, {
    status: 'CLOSED',
    statusLabel: 'Closed',
    statusTone: 'neutral',
    createdLabel: '12 Sep 2026',
    dealerName: 'Katpadi Motors',
    vehicle: { title: '2020 Maruti Suzuki Swift VXi', href: null },
  }),
];

function list(
  data: CustomerEnquiry[],
  overrides: Partial<CustomerEnquiriesResponse> = {},
): CustomerEnquiriesResponse {
  return { data, page: { nextCursor: null, hasMore: false }, ...overrides };
}

const meta = {
  title: 'Vehicle/CustomerEnquiryList',
  component: CustomerEnquiryList,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: { enquiries: { control: false } },
  args: { enquiries: list(EVERY_STATE) },
} satisfies Meta<typeof CustomerEnquiryList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EveryState: Story = {};

export const Empty: Story = { args: { enquiries: list([]) } };

export const MorePages: Story = {
  args: { enquiries: list(EVERY_STATE, { page: { nextCursor: 'next', hasMore: true } }) },
};

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
