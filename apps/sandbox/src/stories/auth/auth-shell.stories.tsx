import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AuthHeading, AuthShell } from '@/components/auth/auth-shell';

const meta = {
  title: 'Layout/AuthShell',
  component: AuthShell,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ minHeight: '100dvh', background: '#fff' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: { eyebrow: { control: 'text' } },
  args: {
    children: (
      <AuthHeading title="Sign in">
        Use the Google account your dealership is registered with.
      </AuthHeading>
    ),
  },
} satisfies Meta<typeof AuthShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const CustomEyebrow: Story = { args: { eyebrow: 'Dealers-Drive admin' } };

export const HeadingWithAndWithoutSubtitle: Story = {
  args: {
    children: (
      <>
        <AuthHeading title="Welcome back">
          Use the Google account your dealership is registered with.
        </AuthHeading>
        <AuthHeading title="Sign in" />
      </>
    ),
  },
};
