import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CustomerReactivation } from '@/features/auth/customer-reactivation';
import { signInActionStub } from '../../mocks/sign-in-actions';

const meta = {
  title: 'Forms/CustomerReactivation',
  component: CustomerReactivation,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 700 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    flowId: '11111111-1111-4111-8111-111111111111',
    phoneDisplay: '+91 95566 00001',
    fullName: 'Fixture Customer',
    onDone: () => undefined,
    onRestart: () => undefined,
  },
  beforeEach: () => {
    signInActionStub.signUp = { done: true };
  },
} satisfies Meta<typeof CustomerReactivation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Confirm: Story = {};
export const Expired: Story = {
  beforeEach: () => {
    signInActionStub.signUp = { error: 'This confirmation has expired. Verify again.' };
  },
};
