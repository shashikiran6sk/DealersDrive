import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CreditBalance, CreditLedger, CreditOrders, CreditPacks } from '@/features/dealer/billing';

import { MOCK_LEDGER, MOCK_ORDERS, MOCK_PACKS, mockBilling } from '../../mocks/listing-credits';

const meta = {
  title: 'Dealer/CreditPacks',
  component: CreditPacks,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  argTypes: { packs: { control: 'object' }, canPurchase: { control: 'boolean' } },
  args: { packs: MOCK_PACKS, canPurchase: true },
} satisfies Meta<typeof CreditPacks>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Packs: Story = {};

export const ManagerCannotBuy: Story = { args: { canPurchase: false } };

export const NoGateway: Story = { args: { packs: { ...MOCK_PACKS, purchasable: false } } };

export const Balance: Story = { render: () => <CreditBalance summary={mockBilling()} /> };

export const EmptyBalance: Story = {
  render: () => <CreditBalance summary={mockBilling({ balance: 0, held: 0, available: 0 })} />,
};

export const Ledger: Story = { render: () => <CreditLedger entries={MOCK_LEDGER} /> };

export const EmptyLedger: Story = { render: () => <CreditLedger entries={[]} /> };

export const Orders: Story = { render: () => <CreditOrders orders={MOCK_ORDERS} /> };
