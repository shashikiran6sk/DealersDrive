import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SignOutButton } from '@/features/auth/sign-out';

/**
 * Sign out — a form, not a link.
 *
 * A GET that ends a session can be triggered by any `<img>` on any page, so
 * this posts. The two scopes below hit different API paths and revoke sessions
 * in different scopes; they look identical on purpose, because a person in both
 * consoles should not have to learn two controls.
 *
 * The Server Action is stubbed here — coupling C-4, see `mocks/auth-actions.ts`.
 */
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

/** Both scopes together, which is the point: they are the same control. */
export const BothScopes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
      <SignOutButton scope="dealer" />
      <SignOutButton scope="admin" />
    </div>
  ),
};

/** The console header passes its own class rather than wrapping the button. */
export const CustomClassName: Story = {
  args: { className: 'btn btn-secondary text-[13px]' },
};
