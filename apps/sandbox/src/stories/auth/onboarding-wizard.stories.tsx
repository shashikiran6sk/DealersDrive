import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AuthShell } from '@/components/auth/auth-shell';
import { ONBOARDING_STEPS, OnboardingWizard } from '@/features/auth/onboarding-wizard';

/**
 * DESIGN-SPEC §3.10 — the onboarding wizard's frame (C040).
 *
 * **This is the shell, not the wizard.** F037 lands which step is current, how
 * a step is reached and the progress indicator; the four step bodies arrive
 * with F038, F039, F041 and F042. So what these stories show is deliberately
 * sparse — a stepper and the movement between steps — and that sparseness is
 * the thing to check, because everything else is layered on top of it.
 *
 * `step` is the *server's* answer, not a preference. The page computes a floor
 * from the session — no dealership yet is 0, a DRAFT one is 2, one already
 * submitted is 3 — and clamps `?step=` into it, so the control below stands in
 * for a session state rather than for a click.
 *
 * The wizard calls `useRouter().push` on Back from step 1, which needs the App
 * Router mock — hence `nextjs.appDirectory`. Without it the story throws on
 * that click rather than on render, which is the slower kind of failure to
 * find.
 */
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
  },
  args: { step: 0 },
} satisfies Meta<typeof OnboardingWizard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * Step 1 — where a Google account with no dealership always lands.
 *
 * Back leaves onboarding altogether rather than moving within it, because
 * there is nothing behind step 1. That is the one navigation on this screen
 * that is not a step change.
 */
export const Account: Story = { args: { step: 0 } };

/**
 * Step 2, reached the way a dealer actually reaches it: `step={0}` and a click
 * on Continue. Passing `step={1}` is the same picture, but it is not a state
 * the server ever produces — the floor is 0 until a dealership exists and 2
 * once one does, so 1 is only ever arrived at locally.
 *
 * Continue is disabled here. It is the submit that creates the dealership, and
 * the form it submits arrives with F039.
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
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      {ONBOARDING_STEPS.map((label, index) => (
        <div key={label}>
          <p style={{ margin: '0 0 10px', fontSize: 12, opacity: 0.55 }}>
            step={index} · {label}
          </p>
          <OnboardingWizard step={index as 0 | 1 | 2 | 3} />
        </div>
      ))}
    </div>
  ),
};
