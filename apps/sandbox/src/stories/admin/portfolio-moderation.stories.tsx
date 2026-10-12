import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { portfolioActionStub } from '../../mocks/portfolio-actions';
import {
  ADMIN_PORTFOLIO_NEW,
  ADMIN_PORTFOLIO_REJECTED,
  ADMIN_PORTFOLIO_REPLACEMENT,
} from '../../mocks/portfolio';

import { PortfolioModerationQueue } from '@/features/admin/portfolio-moderation';

const meta = {
  title: 'Admin/PortfolioModerationQueue',
  component: PortfolioModerationQueue,
  args: {
    status: 'PENDING',
    queue: { data: [ADMIN_PORTFOLIO_NEW, ADMIN_PORTFOLIO_REPLACEMENT] },
  },
  argTypes: { status: { control: 'inline-radio', options: ['PENDING', 'REJECTED'] } },
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  beforeEach: () => {
    portfolioActionStub.result = { ok: true };
    portfolioActionStub.delayMs = 800;
    portfolioActionStub.calls.length = 0;
  },
} satisfies Meta<typeof PortfolioModerationQueue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {};

export const NewPhoto: Story = { args: { queue: { data: [ADMIN_PORTFOLIO_NEW] } } };

export const Replacement: Story = { args: { queue: { data: [ADMIN_PORTFOLIO_REPLACEMENT] } } };

export const ReplacementOfARemovedPhoto: Story = {
  args: {
    queue: { data: [{ ...ADMIN_PORTFOLIO_REPLACEMENT, replacesPreviewUrl: null }] },
  },
};

export const Rejected: Story = {
  args: { status: 'REJECTED', queue: { data: [ADMIN_PORTFOLIO_REJECTED] } },
};

export const NothingWaiting: Story = { args: { queue: { data: [] } } };

export const NoneRejected: Story = { args: { status: 'REJECTED', queue: { data: [] } } };

export const DecisionRefused: Story = {
  beforeEach: () => {
    portfolioActionStub.result = {
      ok: false,
      message: 'That photograph has already been reviewed. Reload the queue.',
    };
  },
};
