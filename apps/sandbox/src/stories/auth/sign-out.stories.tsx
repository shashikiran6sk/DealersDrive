import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SignOutButton } from '@/features/auth/sign-out';

const meta = {
  title: 'Layout/SignOutButton',
  component: SignOutButton,
  parameters: { layout: 'centered' },
  argTypes: {
    scope: { control: 'inline-radio', options: ['dealer', 'admin'] },
    className: { control: 'text' },
  },
  args: { scope: 'dealer' },
} satisfies Meta<typeof SignOutButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const BothScopes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
      <SignOutButton scope="dealer" />
      <SignOutButton scope="admin" />
    </div>
  ),
};

export const CustomClassName: Story = {
  args: { className: 'btn btn-secondary text-[13px]' },
};
