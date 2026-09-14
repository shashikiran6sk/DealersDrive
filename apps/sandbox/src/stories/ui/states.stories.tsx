import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, SkeletonLines, Stepper } from '@/components/ui/primitives';

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

export const Skeleton: Story = {
  args: { title: '', message: '' },
  render: () => (
    <div style={{ maxWidth: 420 }}>
      <SkeletonLines />
    </div>
  ),
};

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
