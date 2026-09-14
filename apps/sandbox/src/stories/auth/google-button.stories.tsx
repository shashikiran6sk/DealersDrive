import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { GoogleSignInButton } from '@/components/auth/google-button';

const meta = {
  title: 'Layout/GoogleSignInButton',
  component: GoogleSignInButton,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 512, margin: '32px auto', background: '#fff', padding: 24 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    href: { control: 'text' },
    label: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  args: { href: 'http://localhost:4000/v1/auth/google/start', disabled: false },
} satisfies Meta<typeof GoogleSignInButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Disabled: Story = { args: { disabled: true } };

export const CustomLabel: Story = { args: { label: 'Sign in with Google' } };
