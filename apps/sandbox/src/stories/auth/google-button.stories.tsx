import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { GoogleSignInButton } from '@/components/auth/google-button';

/**
 * The only control on the dealer sign-in screen.
 *
 * An `<a>`, not a `<button>`: the authorization code flow works by the browser
 * *navigating* to Google, and a fetch could not carry the redirect. Which is
 * why `disabled` renders a `<span aria-disabled>` rather than setting an
 * attribute an anchor does not have — the two stories below are the same
 * control in both of those shapes.
 */
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

/**
 * What a deployment with no `GOOGLE_CLIENT_ID` shows. Inert on purpose: a
 * control that looks alive and fails on click is worse than one that says why
 * it cannot work — the page pairs this with a Banner naming the variables.
 */
export const Disabled: Story = { args: { disabled: true } };

/** The label is a prop because onboarding says "Continue" and sign-in says "Sign in". */
export const CustomLabel: Story = { args: { label: 'Sign in with Google' } };
