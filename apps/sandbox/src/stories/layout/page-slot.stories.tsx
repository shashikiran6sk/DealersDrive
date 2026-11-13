import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PageSlot } from '@/components/layout/page-slot';

const meta = {
  title: 'Layout/PageSlot',
  component: PageSlot,
  parameters: { layout: 'padded' },
  args: {
    children: (
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px]">Contact Dealers-Drive</h1>
        <p className="ink-muted">The page a layout frames, rendered unchanged.</p>
      </div>
    ),
  },
  render: (args) => (
    <main className="rounded-[12px] border border-dashed border-(--color-divider) p-4">
      <PageSlot {...args} />
    </main>
  ),
} satisfies Meta<typeof PageSlot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InsideMain: Story = {};
