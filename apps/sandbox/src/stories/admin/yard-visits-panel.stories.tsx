import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { YardVisitsPanel } from '@/features/admin/yard-visits';

import { adminActionStub } from '../../mocks/admin-actions';
import { YARD_VISITS } from '../../mocks/admin-dealer';

const meta = {
  title: 'Admin/YardVisitsPanel',
  component: YardVisitsPanel,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => {
      adminActionStub.delayMs = 900;
      adminActionStub.result = { ok: true };
      adminActionStub.calls = [];
      return (
        <div style={{ maxWidth: 720 }}>
          <Story />
        </div>
      );
    },
  ],
  args: {
    dealerId: '3c8f2b10-2222-4000-8000-000000000002',
    visits: YARD_VISITS,
  },
  argTypes: { visits: { control: 'object' } },
} satisfies Meta<typeof YardVisitsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllOutcomes: Story = {};

export const NoPhysicalYard: Story = {
  name: 'Trades without a yard — not a penalty',
  args: { visits: YARD_VISITS.filter((visit) => visit.outcome === 'NO_PHYSICAL_YARD') },
};

export const NothingRecorded: Story = { args: { visits: [] } };

export const NotPermitted: Story = {
  name: 'Support admin (403) — renders nothing',
  args: { visits: null },
};

export const Recording: Story = {
  args: { visits: [] },
  decorators: [
    (Story) => {
      adminActionStub.delayMs = 8_000;
      adminActionStub.result = { ok: true };
      return <Story />;
    },
  ],
};

export const RecordRefused: Story = {
  args: { visits: [] },
  decorators: [
    (Story) => {
      adminActionStub.delayMs = 400;
      adminActionStub.result = {
        ok: false,
        message: 'This action needs the admin:visit:manage permission.',
      };
      return <Story />;
    },
  ],
};
