import type { AuthSession } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { authActionStub } from '../../mocks/auth-actions';

import { AuthShell } from '@/components/auth/auth-shell';
import { ONBOARDING_STEPS, OnboardingWizard } from '@/features/auth/onboarding-wizard';

/**
 * DESIGN-SPEC §3.10 — the onboarding wizard (C040).
 *
 * F037 landed the frame — which step is current, how a step is reached and the
 * progress indicator. **F038 lands step 1**, the Account step; Business,
 * Documents and Review arrive with F039, F041 and F042, so the later steps are
 * still deliberately sparse.
 *
 * `step` is the *server's* answer, not a preference. The page computes a floor
 * from the session — no dealership yet is 0, a DRAFT one is 2, one already
 * submitted is 3 — and clamps `?step=` into it, so the control below stands in
 * for a session state rather than for a click.
 *
 * The wizard calls `useRouter().push` on Back from step 1, which needs the App
 * Router mock — hence `nextjs.appDirectory`. Without it the story throws on
 * that click rather than on render, which is the slower kind of failure to
 * find. It also calls `onboardingAction`, a Server Action, which the sandbox
 * aliases to `src/mocks/auth-actions.ts` (coupling C-4).
 */

/** A signed-in Google account with no dealership — the only state step 1 renders in. */
function session(overrides: Partial<AuthSession['user']> = {}, identityName = 'Karthik Raman') {
  return {
    next: 'ONBOARDING',
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      fullName: null,
      roleTitle: null,
      phone: '',
      phoneDisplay: '',
      email: 'karthik@srilakshmimotors.in',
      emailVerified: true,
      ...overrides,
    },
    identity: {
      provider: 'GOOGLE',
      email: 'karthik@srilakshmimotors.in',
      name: identityName,
      pictureUrl: null,
    },
    dealer: null,
    role: null,
    permissions: [],
    counts: { newEnquiries: 0, pendingListings: 0 },
  } satisfies AuthSession;
}

const meta = {
  title: 'Forms/OnboardingWizard',
  component: OnboardingWizard,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ minHeight: '100dvh', background: '#fff' }}>
        <AuthShell>
          <Story />
        </AuthShell>
      </div>
    ),
  ],
  argTypes: {
    step: {
      control: 'inline-radio',
      options: [0, 1, 2, 3],
      description: 'The floor the server resolved from the session.',
    },
    session: { control: false, description: 'GET /v1/auth/me. Step 1 is the only reader.' },
  },
  args: { step: 0, session: session() },
  beforeEach: () => {
    authActionStub.result = {};
    authActionStub.delayMs = 900;
    authActionStub.calls.length = 0;
  },
} satisfies Meta<typeof OnboardingWizard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * Step 1 — where a Google account with no dealership always lands, with nothing
 * on the user record yet. Name comes from the Google profile; phone is blank,
 * because Google does not supply one.
 *
 * Back leaves onboarding altogether rather than moving within it, because
 * there is nothing behind step 1. That is the one navigation on this screen
 * that is not a step change.
 */
export const Account: Story = { args: { step: 0 } };

/**
 * The same step for somebody returning: the user record already holds a name,
 * a role and a phone, and those win over the Google profile. The email does
 * not change either way — it is shown, not asked for.
 */
export const AccountPrefilled: Story = {
  args: {
    step: 0,
    session: session({ fullName: 'K. Raman', roleTitle: 'Proprietor', phone: '9840012345' }),
  },
};

/*
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * **The error and submitting states of step 1 are not stories yet, and that is
 * deliberate.** Both are `useActionState` states, and reaching one needs a
 * submit — which is the Business step's, and arrives with **F039**. A story
 * that primes `authActionStub` for a state nothing on screen can trigger looks
 * like coverage and is not: nobody could verify it by eye, which is the whole
 * point of the sandbox. They land with the control that produces them, beside
 * the Business step's own scenarios.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * Step 2, reached the way a dealer actually reaches it: `step={0}` and a click
 * on Continue. Passing `step={1}` is the same picture, but it is not a state
 * the server ever produces — the floor is 0 until a dealership exists and 2
 * once one does, so 1 is only ever arrived at locally.
 *
 * Continue is disabled here. It is the submit that creates the dealership, and
 * the fields it submits arrive with F039.
 */
export const Business: Story = { args: { step: 1 } };

/**
 * Step 3 — a DRAFT dealership exists, so the server's floor is 2 and steps 1
 * and 2 are behind you. Note that the Back/Continue row is gone: from here on
 * the movement is by navigation, and each step body brings its own controls.
 */
export const Documents: Story = { args: { step: 2 } };

/** Step 4 — submitted, awaiting approval. The floor is 3 and nothing moves. */
export const Review: Story = { args: { step: 3 } };

/**
 * All four at once, which is the only way to see that the stepper fills
 * cumulatively rather than marking a single position — `index <= current`,
 * C015.
 */
export const EveryStep: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      {ONBOARDING_STEPS.map((label, index) => (
        <div key={label}>
          <p style={{ margin: '0 0 10px', fontSize: 12, opacity: 0.55 }}>
            step={index} · {label}
          </p>
          <OnboardingWizard step={index as 0 | 1 | 2 | 3} session={args.session} />
        </div>
      ))}
    </div>
  ),
};
