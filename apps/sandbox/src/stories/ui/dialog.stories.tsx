import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

function DialogDemo({
  title,
  description,
  wide = false,
  withFooter = true,
}: {
  title: string;
  description?: string;
  wide?: boolean;
  withFooter?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button variant="secondary">Open dialog</Button>}
      title={title}
      description={description}
      closeLabel={`Close ${title.toLowerCase()}`}
      className={wide ? 'w-[min(880px,100%)]' : undefined}
      footer={
        withFooter ? (
          <>
            <p className="text-[13px] ink-muted">Nothing is saved until you confirm.</p>
            <span className="flex gap-[7px]">
              <Button
                variant="secondary"
                onClick={() => {
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setOpen(false);
                }}
              >
                Approve &amp; publish
              </Button>
            </span>
          </>
        ) : undefined
      }
    >
      <div className="space-y-[10px] text-[14px] ink-body">
        <p>
          The scrolling region. Header and footer stay put; only this moves, which is what lets a
          dialog hold a grid of 38 districts without the confirm button leaving the screen.
        </p>
        {wide
          ? Array.from({ length: 14 }, (_, index) => (
              <p key={index}>
                Row {index + 1} — filler, so the scroll and the pinned footer are visible rather
                than described.
              </p>
            ))
          : null}
      </div>
    </Dialog>
  );
}

const meta = {
  title: 'Primitives/Dialog',
  component: DialogDemo,
  parameters: { layout: 'centered' },
  args: { title: 'Approve this listing', description: undefined, wide: false, withFooter: true },
} satisfies Meta<typeof DialogDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: { description: 'The dealer is told, and the credit is consumed.' },
};

export const Wide: Story = {
  args: { title: 'Select location', wide: true },
};

export const NoFooter: Story = { args: { withFooter: false } };
