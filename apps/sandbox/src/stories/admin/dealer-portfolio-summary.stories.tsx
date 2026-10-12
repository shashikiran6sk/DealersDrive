import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DealerPortfolioSummary } from '@/features/admin/dealer-portfolio-summary';

import { ADMIN_PORTFOLIO } from '../../mocks/admin-dealer';
import { portfolioActionStub } from '../../mocks/portfolio-actions';

const meta = {
  title: 'Admin/DealerPortfolioSummary',
  component: DealerPortfolioSummary,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => {
      portfolioActionStub.delayMs = 800;
      portfolioActionStub.result = { ok: true };
      portfolioActionStub.calls = [];
      return (
        <div style={{ maxWidth: 520 }}>
          <Story />
        </div>
      );
    },
  ],
  args: { photos: ADMIN_PORTFOLIO, dealerSlug: 'sri-lakshmi-motors' },
  argTypes: { photos: { control: 'object' } },
} satisfies Meta<typeof DealerPortfolioSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ApprovedAndPending: Story = {};

export const ApprovedOnly: Story = {
  args: { photos: ADMIN_PORTFOLIO.filter((photo) => photo.status === 'APPROVED') },
};

export const Empty: Story = { args: { photos: [] } };

export const TakeDownRefused: Story = {
  decorators: [
    (Story) => {
      portfolioActionStub.delayMs = 400;
      portfolioActionStub.result = {
        ok: false,
        message: 'This photograph has already been taken down.',
      };
      return <Story />;
    },
  ],
};
