import type { SalesDealerSummary } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SalesDealerList } from '@/features/sales/sales-dealer-list';

function dealer(overrides: Partial<SalesDealerSummary> = {}): SalesDealerSummary {
  return {
    id: 'd-1',
    legalName: 'Sri Murugan Cars',
    city: 'Katpadi',
    district: 'Vellore',
    status: 'DRAFT',
    statusLabel: 'Draft',
    statusTone: 'neutral',
    statusReason: null,
    contactName: 'Murugan',
    phoneDisplay: '+91 98400 12345',
    phoneVerified: true,
    emailVerified: false,
    claimed: false,
    createdAt: '2026-10-06T10:00:00.000Z',
    listings: { draft: 2, review: 1, live: 0 },
    ...overrides,
  };
}

const meta = {
  title: 'Sales/SalesDealerList',
  component: SalesDealerList,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[960px] p-[20px]">
        <Story />
      </div>
    ),
  ],
  args: { emptyLabel: 'No dealerships yet — start one from the button above.' },
  argTypes: { dealers: { control: false }, emptyLabel: { control: 'text' } },
} satisfies Meta<typeof SalesDealerList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mixed: Story = {
  name: 'Mixed pipeline',
  args: {
    dealers: [
      dealer(),
      dealer({
        id: 'd-2',
        legalName: 'Vellore Motor Point',
        status: 'PENDING_APPROVAL',
        statusLabel: 'Pending',
        statusTone: 'warn',
        listings: { draft: 0, review: 0, live: 0 },
      }),
      dealer({
        id: 'd-3',
        legalName: 'Kaveri Auto Hub',
        status: 'DRAFT',
        statusLabel: 'Draft',
        statusTone: 'neutral',
        statusReason: 'Upload a clearer GST certificate.',
      }),
      dealer({
        id: 'd-4',
        legalName: 'Anna Nagar Wheels',
        status: 'ACTIVE',
        statusLabel: 'Approved',
        statusTone: 'ok',
        emailVerified: true,
        claimed: true,
        listings: { draft: 0, review: 0, live: 12 },
      }),
    ],
  },
};

export const Empty: Story = { args: { dealers: [] } };
