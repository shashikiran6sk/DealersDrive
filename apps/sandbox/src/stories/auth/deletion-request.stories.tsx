import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DeletionRequest } from '@/features/account/deletion-request';
import { accountActionStub } from '../../mocks/account-actions';

const meta = {
  title: 'Forms/CustomerDeletionRequest',
  component: DeletionRequest,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 700 }}>
        <Story />
      </div>
    ),
  ],
  args: { customerId: '11111111-1111-4111-8111-111111111111' },
  beforeEach: () => {
    accountActionStub.deletion = { reference: 'DD-2001', error: undefined };
  },
} satisfies Meta<typeof DeletionRequest>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Unticked: Story = {};
