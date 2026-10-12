import type { DealerVerificationReview } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DealerVerificationReviewPanel } from '@/features/admin/dealer-verification';

const DEALER = '11111111-1111-4111-8111-111111111111';
const ADMIN = '22222222-2222-4222-8222-222222222222';

const NOT_VERIFIED: DealerVerificationReview = {
  dealerId: DEALER,
  status: 'NOT_VERIFIED',
  statusLabel: 'Not verified',
  version: 0,
  verifiedAt: null,
  reviewerId: null,
  transitions: ['PENDING', 'IN_REVIEW'],
  history: [],
};

const meta = {
  title: 'Admin/DealerVerificationReviewPanel',
  component: DealerVerificationReviewPanel,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[720px] p-[20px]">
        <Story />
      </div>
    ),
  ],
  args: { initial: NOT_VERIFIED },
  argTypes: { initial: { control: 'object' } },
} satisfies Meta<typeof DealerVerificationReviewPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotVerified: Story = { name: 'Not verified' };

export const InReview: Story = {
  name: 'In review',
  args: {
    initial: {
      ...NOT_VERIFIED,
      status: 'IN_REVIEW',
      statusLabel: 'Verification in review',
      version: 1,
      transitions: ['VERIFIED', 'REJECTED'],
      history: [
        {
          id: '1',
          at: '2026-10-12T06:30:00Z',
          actorId: ADMIN,
          from: 'NOT_VERIFIED',
          to: 'IN_REVIEW',
          reason: null,
        },
      ],
    },
  },
};

export const Verified: Story = {
  name: 'Verified (revoke needs a reason)',
  args: {
    initial: {
      ...NOT_VERIFIED,
      status: 'VERIFIED',
      statusLabel: 'Dealer Verified',
      version: 2,
      verifiedAt: '2026-10-12T07:00:00Z',
      reviewerId: ADMIN,
      transitions: ['REVOKED'],
      history: [
        {
          id: '2',
          at: '2026-10-12T07:00:00Z',
          actorId: ADMIN,
          from: 'IN_REVIEW',
          to: 'VERIFIED',
          reason: null,
        },
        {
          id: '1',
          at: '2026-10-12T06:30:00Z',
          actorId: ADMIN,
          from: 'NOT_VERIFIED',
          to: 'IN_REVIEW',
          reason: null,
        },
      ],
    },
  },
};
