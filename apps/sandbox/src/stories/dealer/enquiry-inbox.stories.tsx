import type { DealerEnquiriesResponse, DealerEnquiry } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { dealerEnquiryActionStub } from '../../mocks/dealer-enquiry-actions';

import { EnquiryInbox } from '@/features/dealer/enquiries';

function enquiry(n: number, overrides: Partial<DealerEnquiry> = {}): DealerEnquiry {
  return {
    id: `0000000${String(n)}-1111-4111-8111-111111111111`,
    status: 'NEW',
    statusLabel: 'New',
    statusTone: 'accent',
    message: null,
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
    ...overrides,
  };
}

const NEW_ROWS: DealerEnquiry[] = [
  enquiry(1, { message: 'Is the price negotiable? I can come on Saturday morning.' }),
  enquiry(2, {
    timeAgoLabel: '3 hours ago',
    customer: {
      name: 'Meena Sundaram',
      initials: 'MS',
      phone: '+919444055501',
      phoneDisplay: '+91 94440 55501',
      callHref: 'tel:+919444055501',
    },
    vehicle: {
      id: '33333333-3333-4333-8333-333333333333',
      title: '2020 Maruti Suzuki Swift VXi',
      registrationDisplay: 'TN 23 MN 4411',
      listingStatus: 'SOLD',
      href: null,
    },
  }),
  enquiry(3, {
    timeAgoLabel: '2 days ago',
    message: 'Does it have service records?',
    customer: {
      name: 'Karthik',
      initials: 'KA',
      phone: null,
      phoneDisplay: null,
      callHref: null,
    },
  }),
];

const COUNTS = { ALL: 9, NEW: 3, CONTACTED: 4, CLOSED: 1, SPAM: 1 };

function inbox(
  data: DealerEnquiry[],
  overrides: Partial<DealerEnquiriesResponse> = {},
): DealerEnquiriesResponse {
  return { data, page: { nextCursor: null, hasMore: false }, counts: COUNTS, ...overrides };
}

const meta = {
  title: 'Dealer/EnquiryInbox',
  component: EnquiryInbox,
  parameters: { layout: 'padded' },
  argTypes: {
    status: { control: 'inline-radio', options: ['NEW', 'CONTACTED', 'CLOSED', 'SPAM'] },
    inbox: { control: false },
  },
  args: { inbox: inbox(NEW_ROWS), status: 'NEW' },
  beforeEach: () => {
    dealerEnquiryActionStub.result = { ok: true };
    dealerEnquiryActionStub.calls = [];
  },
} satisfies Meta<typeof EnquiryInbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const New: Story = {};

export const Contacted: Story = {
  args: {
    status: 'CONTACTED',
    inbox: inbox([
      enquiry(4, {
        status: 'CONTACTED',
        statusLabel: 'Contacted',
        statusTone: 'ok',
        contactedAt: '2026-09-28T11:00:00.000Z',
        message: 'Can I take it for a test drive?',
      }),
    ]),
  },
};

export const Closed: Story = {
  args: {
    status: 'CLOSED',
    inbox: inbox([
      enquiry(5, {
        status: 'CLOSED',
        statusLabel: 'Closed',
        statusTone: 'neutral',
        closedAt: '2026-09-28T12:00:00.000Z',
      }),
    ]),
  },
};

export const Spam: Story = {
  args: {
    status: 'SPAM',
    inbox: inbox([
      enquiry(6, {
        status: 'SPAM',
        statusLabel: 'Spam',
        statusTone: 'err',
        message: 'Earn ₹50,000 a week from home!!!',
      }),
    ]),
  },
};

export const Empty: Story = {
  args: { inbox: inbox([], { counts: { ALL: 0, NEW: 0, CONTACTED: 0, CLOSED: 0, SPAM: 0 } }) },
};

export const MorePages: Story = {
  args: { inbox: inbox(NEW_ROWS, { page: { nextCursor: 'next', hasMore: true } }) },
};

export const MoveRefused: Story = {
  beforeEach: () => {
    dealerEnquiryActionStub.result = {
      ok: false,
      message: 'That enquiry is not in your inbox.',
    };
  },
};

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
