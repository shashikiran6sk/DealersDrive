import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AuthHeading, AuthShell } from '@/components/auth/auth-shell';

/**
 * DESIGN-SPEC §3.9 — the shell every authentication screen sits in.
 *
 * Three pages use it: dealer sign-in (F018), dealer onboarding (F037) and the
 * admin console login (F019). `/admin/login` lives under a different route
 * segment from the other two, which is exactly why this is a component and not
 * a route layout — a shared component crosses that boundary where a layout
 * cannot.
 *
 * The white field behind the column is the `(auth)` route layout's, not this
 * component's, so the decorator below supplies it. Without it the shell renders
 * on Storybook's default ground and looks nothing like the real screen.
 */
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

/** The default eyebrow — what a dealer sees at `/dealer/login`. */
export const Playground: Story = {};

/**
 * The admin console overrides the eyebrow. It is the only visible difference
 * between the two sign-in screens above the fold, so it has to be legible.
 */
export const CustomEyebrow: Story = { args: { eyebrow: 'Dealers-Drive admin' } };

/** The heading on its own, with and without the 15px subtitle line. */
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
