import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, SkeletonLines, Stepper } from '@/components/ui/primitives';

/**
 * The four state primitives — DESIGN-SPEC §2.16 and §2.20. These are the
 * screens people see when something is missing, broken or still loading, which
 * is exactly when a rough edge costs the most.
 */
const meta = {
  title: 'Primitives/States',
  component: EmptyState,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { title: 'No listings yet', message: 'Add your first vehicle to get started.' },
};

export const EmptyWithAction: Story = {
  args: { title: 'No listings yet', message: 'Add your first vehicle to get started.' },
  render: () => (
    <EmptyState
      title="No listings yet"
      message="Add your first vehicle to get started."
      action={<Button variant="primary">Add a vehicle</Button>}
    />
  ),
};

/**
 * The message is clamped to `max-w-[46ch]`. This is the story that shows where
 * that clamp lands — long copy should wrap inside it, never run the full width.
 */
export const EmptyLongMessage: Story = {
  args: {
    title: 'Nothing matches those filters',
    message:
      'No vehicle in this city matches every filter you have applied. Try widening the price range, or removing the body-type filter — those two together are the most common reason a search comes back empty.',
  },
};

export const Error_: Story = {
  name: 'Error',
  args: { title: 'Could not load listings', message: 'The request timed out.' },
  render: () => <ErrorState title="Could not load listings" message="The request timed out." />,
};

export const ErrorWithRetry: Story = {
  args: { title: 'Could not load listings', message: 'The request timed out.' },
  render: () => (
    <ErrorState
      title="Could not load listings"
      message="The request timed out."
      action={<Button>Try again</Button>}
    />
  ),
};

/** Static bars, no shimmer (§1.7). Motion during loading is noise. */
export const Skeleton: Story = {
  args: { title: '', message: '' },
  render: () => (
    <div style={{ maxWidth: 420 }}>
      <SkeletonLines />
    </div>
  ),
};

/** Every position, walked through. */
export const StepperPositions: Story = {
  args: { title: '', message: '' },
  render: () => {
    const steps = ['Registration', 'Basics', 'Details', 'Photos'] as const;
    return (
      <div style={{ display: 'grid', gap: 28, maxWidth: 520 }}>
        {[0, 1, 2, 3].map((current) => (
          <div key={current}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>current={current}</div>
            <Stepper steps={steps} current={current} />
          </div>
        ))}
      </div>
    );
  },
};

/**
 * ⚠️ **A known defect, rendered on purpose.**
 *
 * `Stepper` fills a bar when `index <= current`, with no upper bound. An
 * out-of-range `current` therefore fills *every* bar and the control silently
 * claims the flow is complete — the same picture as a genuinely finished
 * wizard. A step count that shrinks, or an off-by-one at the last step, lands
 * here.
 *
 * This is not fixed as part of the reconstruction: changing behaviour under
 * cover of a port is what the whole exercise is meant to avoid. It is rendered
 * so the decision is visible and can be taken on its own.
 */
export const StepperOutOfRange: Story = {
  args: { title: '', message: '' },
  render: () => {
    const steps = ['Registration', 'Basics', 'Details', 'Photos'] as const;
    return (
      <div style={{ display: 'grid', gap: 28, maxWidth: 520 }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 6 }}>current=3 — genuinely complete</div>
          <Stepper steps={steps} current={3} />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 6 }}>
            current=9 — out of range, and indistinguishable from complete
          </div>
          <Stepper steps={steps} current={9} />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 6 }}>current=-1 — nothing filled</div>
          <Stepper steps={steps} current={-1} />
        </div>
      </div>
    );
  },
};
