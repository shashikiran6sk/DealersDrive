import type { AdminNotificationRow } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { NotificationLog } from '@/features/admin/notification-log';

function row(overrides: Partial<AdminNotificationRow> = {}): AdminNotificationRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    template: 'admin.application.received',
    recipient: 'priya@dealers-drive.in',
    subject: 'New dealer application — Kaveri Auto Hub',
    status: 'SENT',
    statusLabel: 'Sent',
    statusTone: 'ok',
    attempts: 1,
    lastError: null,
    dealer: { id: '22222222-2222-4222-8222-222222222222', name: 'Kaveri Auto Hub' },
    createdAt: '2026-10-07T03:00:00.000Z',
    createdLabel: '07 Oct 2026, 08:30',
    sentAt: '2026-10-07T03:00:01.000Z',
    ...overrides,
  };
}

const meta = {
  title: 'Admin/NotificationLog',
  component: NotificationLog,
  decorators: [
    (Story) => (
      <div className="p-[20px]">
        <Story />
      </div>
    ),
  ],
  args: {
    filters: {},
    deliveries: {
      data: [
        row(),
        row({
          id: '11111111-1111-4111-8111-111111111112',
          template: 'dealer.email.verify',
          recipient: 'selvi@gmail.com',
          subject: 'Confirm your email and claim Claimable Motors — Dealers-Drive',
          status: 'PENDING',
          statusLabel: 'Retrying',
          statusTone: 'warn',
          attempts: 2,
          lastError: 'Resend answered 503',
          sentAt: null,
        }),
        row({
          id: '11111111-1111-4111-8111-111111111113',
          template: 'dealer.application.approved',
          recipient: 'owner@typo.example',
          subject: 'Kaveri Auto Hub is verified — Dealers-Drive',
          status: 'FAILED',
          statusLabel: 'Failed',
          statusTone: 'err',
          attempts: 1,
          lastError: 'Resend refused it (422): invalid recipient',
          sentAt: null,
        }),
      ],
      page: { nextCursor: 'next', hasMore: true },
      counts: { ALL: 3, PENDING: 1, SENT: 1, FAILED: 1 },
    },
  },
  argTypes: { deliveries: { control: 'object' }, filters: { control: 'object' } },
} satisfies Meta<typeof NotificationLog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mixed: Story = {};

export const FailedOnly: Story = { args: { filters: { status: 'FAILED' } } };

export const Empty: Story = {
  args: {
    filters: { q: 'nobody@example.com' },
    deliveries: {
      data: [],
      page: { nextCursor: null, hasMore: false },
      counts: { ALL: 0, PENDING: 0, SENT: 0, FAILED: 0 },
    },
  },
};
