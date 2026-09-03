import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AdminLoginForm } from '@/features/auth/admin-login-form';

import { authActionStub } from '../../mocks/auth-actions';

/**
 * The admin console's only door.
 *
 * `adminLoginAction` is a Server Action, so the sandbox aliases the whole
 * module to `src/mocks/auth-actions.ts` — coupling C-4. `authActionStub` is
 * what each story sets to choose what that action answers, which is how the
 * four states below are reachable with the network off.
 *
 * Worth looking at rather than reading: a failed attempt keeps the typed email.
 * `useActionState` is what does that, and it is the difference between a wrong
 * password and a form that punishes you for one.
 */
const meta = {
  title: 'Forms/AdminLoginForm',
  component: AdminLoginForm,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 512, margin: '32px auto', background: '#fff', padding: 24 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: { initialMessage: { control: 'text' } },
} satisfies Meta<typeof AdminLoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Idle. Submit it to watch the disabled "Signing in…" state for ~1s. */
export const Idle: Story = {
  beforeEach: () => {
    authActionStub.delayMs = 900;
    authActionStub.result = {};
  },
};

/**
 * What a wrong password looks like — and, deliberately, what an unknown account
 * looks like too. The two are indistinguishable from outside, in wording and in
 * timing, which is the property `auth.service.ts` spends a decoy hash on.
 */
export const ServerError: Story = {
  beforeEach: () => {
    authActionStub.delayMs = 400;
    authActionStub.result = { message: 'That email and password do not match.' };
  },
  args: { initialMessage: 'That email and password do not match.' },
};

/** Per-field errors, from the `.strict()` Zod schema the action parses against. */
export const FieldErrors: Story = {
  beforeEach: () => {
    authActionStub.delayMs = 400;
    authActionStub.result = {
      errors: { email: 'Enter a valid email address.', password: 'Enter your password.' },
    };
  },
};

/**
 * The banner a redirect from an expired admin session carries. It arrives as a
 * prop rather than as action state, because nothing has been submitted yet.
 */
export const SessionExpired: Story = {
  args: { initialMessage: 'Your session has ended. Sign in again.' },
};
