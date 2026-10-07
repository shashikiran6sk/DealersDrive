import type { DealerInventoryRow } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SalesVehicleList } from '@/features/sales/sales-vehicle-list';

const DEALER = '44444444-4444-4444-8444-444444444444';

function row(overrides: Partial<DealerInventoryRow> = {}): DealerInventoryRow {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    title: '2021 Hyundai Creta SX',
    registrationDisplay: 'UP 32 SR 1001',
    summary: 'Petrol · Manual',
    priceLabel: '₹9,50,000',
    status: 'DRAFT',
    statusLabel: 'Draft',
    statusTone: 'neutral',
    reason: null,
    complete: false,
    slug: null,
    actions: [],
    reactivationPending: false,
    updatedAt: '2026-10-06T10:00:00.000Z',
    updatedLabel: 'today',
    ...overrides,
  };
}

const meta = {
  title: 'Sales/SalesVehicleList',
  component: SalesVehicleList,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[720px] p-[20px]">
        <Story />
      </div>
    ),
  ],
  args: {
    dealerId: DEALER,
    listings: {
      dealerApproved: true,
      canCreate: true,
      data: [
        row(),
        row({
          id: '22222222-2222-4222-8222-222222222223',
          title: '2019 Maruti Swift VXi',
          registrationDisplay: 'UP 32 SR 1002',
          status: 'PENDING_REVIEW',
          statusLabel: 'In review',
          statusTone: 'warn',
        }),
        row({
          id: '22222222-2222-4222-8222-222222222224',
          title: '2018 Honda City V',
          registrationDisplay: 'UP 32 SR 1003',
          status: 'CHANGES_REQUESTED',
          statusLabel: 'Changes requested',
          statusTone: 'err',
          reason: 'Add the service history.',
        }),
      ],
    },
  },
  argTypes: { listings: { control: 'object' }, dealerId: { control: false } },
} satisfies Meta<typeof SalesVehicleList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Approved: Story = {};

export const BeforeApproval: Story = {
  args: { listings: { dealerApproved: false, canCreate: true, data: [row()] } },
};

export const Empty: Story = {
  args: { listings: { dealerApproved: true, canCreate: true, data: [] } },
};

export const Closed: Story = {
  args: { listings: { dealerApproved: false, canCreate: false, data: [] } },
};
