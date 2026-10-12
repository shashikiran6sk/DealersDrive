import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  PORTFOLIO_APPROVED,
  PORTFOLIO_EMPTY,
  PORTFOLIO_FULL,
  PORTFOLIO_MIXED,
  PORTFOLIO_PENDING,
  PORTFOLIO_REJECTED,
  PORTFOLIO_REPLACEMENT_PENDING,
} from '../../mocks/portfolio';

import { PortfolioManager } from '@/features/dealer/portfolio-manager';

const meta = {
  title: 'Dealer/PortfolioManager',
  component: PortfolioManager,
  args: { portfolio: PORTFOLIO_MIXED },
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
} satisfies Meta<typeof PortfolioManager>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mixed: Story = {};

export const Empty: Story = { args: { portfolio: PORTFOLIO_EMPTY } };

export const Pending: Story = { args: { portfolio: PORTFOLIO_PENDING } };

export const Approved: Story = { args: { portfolio: PORTFOLIO_APPROVED } };

export const RejectedWithReason: Story = { args: { portfolio: PORTFOLIO_REJECTED } };

export const ReplacementPending: Story = { args: { portfolio: PORTFOLIO_REPLACEMENT_PENDING } };

export const Full: Story = { args: { portfolio: PORTFOLIO_FULL } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
