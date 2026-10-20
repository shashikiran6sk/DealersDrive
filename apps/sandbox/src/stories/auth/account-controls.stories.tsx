import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AccountControlsHost } from '@/features/account/account-controls-host';
import { accountActionStub } from '../../mocks/account-actions';

const meta = {
  title: 'Forms/CustomerAccountControls',
  component: AccountControlsHost,
  parameters: { layout: 'padded', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 700 }}>
        <Story />
      </div>
    ),
  ],
  args: { customerId: '11111111-1111-4111-8111-111111111111', canDeactivate: true },
  beforeEach: () => {
    accountActionStub.deactivate = { done: true, error: undefined, reauth: false };
  },
} satisfies Meta<typeof AccountControlsHost>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FreshOtp: Story = {};
export const RequiresOtp: Story = { args: { canDeactivate: false } };
export const Guest: Story = { args: { customerId: null, canDeactivate: false } };
export const Refused: Story = {
  beforeEach: () => {
    accountActionStub.deactivate = {
      done: false,
      error: 'Verification is required. Please try again.',
      reauth: true,
    };
  },
};
