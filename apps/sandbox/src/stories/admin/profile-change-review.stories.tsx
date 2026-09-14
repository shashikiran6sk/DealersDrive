import type { AdminProfileChange } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ProfileChangeReview } from '@/features/admin/profile-change-review';

import { adminActionStub } from '../../mocks/admin-actions';

const BASE: AdminProfileChange = {
  id: '9a1e4c22-0000-4000-8000-000000000009',
  dealerId: '3c8f2b10-2222-4000-8000-000000000002',
  dealerSlug: 'sri-lakshmi-motors',
  dealerName: 'Sri Lakshmi Motors',
  initials: 'SL',
  status: 'PENDING',
  statusLabel: 'Waiting for review',
  statusTone: 'warn',
  tagline: 'Only diesel SUVs now, every one with a full service history.',
  specialities: ['SUVs', 'Exchange', 'Bank loan tie-ups'],
  liveTagline: 'Hatchbacks under ₹6 lakh, every one inspected in-house.',
  liveSpecialities: ['Hatchbacks', 'RC transfer assistance'],
  submittedAt: '2026-09-09T09:00:00.000Z',
  submittedAtLabel: '09 Sep 2026',
  waitingLabel: '4 hours',
  decisionReason: null,
};

const change = (overrides: Partial<AdminProfileChange> = {}): AdminProfileChange => ({
  ...BASE,
  ...overrides,
});

const meta = {
  title: 'Admin/ProfileChangeReview',
  component: ProfileChangeReview,
  args: { change: BASE },
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    adminActionStub.result = { ok: true };
    adminActionStub.delayMs = 900;
    adminActionStub.calls.length = 0;
  },
} satisfies Meta<typeof ProfileChangeReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PhoneNumberInTheTagline: Story = {
  args: {
    change: change({
      tagline: 'Best prices in Vellore — call 98400 12345 direct, no middleman!',
      specialities: [],
    }),
  },
};

export const ServicesOnly: Story = {
  args: { change: change({ tagline: null }) },
};

export const TaglineOnly: Story = {
  args: { change: change({ specialities: [] }) },
};

export const NothingLiveToCompareAgainst: Story = {
  args: { change: change({ liveTagline: null, liveSpecialities: [] }) },
};

export const Refusing: Story = {
  args: { change: change() },
  play: ({ canvasElement }) => {
    const refuse = [...canvasElement.querySelectorAll('button')].find((node) =>
      node.textContent?.startsWith('Refuse'),
    );
    refuse?.click();
  },
};

export const AlreadyDecided: Story = {
  args: { change: change() },
  beforeEach: () => {
    adminActionStub.result = { ok: false, message: 'This edit has already been published.' };
    adminActionStub.delayMs = 400;
  },
};

export const Deciding: Story = {
  args: { change: change() },
  beforeEach: () => {
    adminActionStub.delayMs = 8000;
  },
};
