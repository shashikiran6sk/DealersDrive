import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * DESIGN-SPEC §2.14 — the modal dialog, **new at R22**.
 *
 * ## Why it is new when the CSS is not
 *
 * `.dialog` and `.dialog-backdrop` have been in the baseline's stylesheet
 * throughout, with **zero consumers** — the baseline's one real dialog is drawn
 * with Radix (component-map finding **D-C**). Two dialog strategies, one of them
 * dead, and the next person with a dialog to build picking whichever they found
 * first. The same document's recommendation was that `Dialog` be among the first
 * shared components created, at the moment its first consumer lands. That
 * moment is R22 and `LocationSelector`.
 *
 * It is Radix underneath and the design system on top. The list of things a
 * modal has to get right is longer than it looks and every item on it is a bug
 * only a keyboard or screen-reader user meets: focus into the panel, focus
 * trapped inside it, focus back on the trigger on the way out, the document
 * behind it inert, the body's scroll locked. Re-writing that would be writing it
 * worse.
 *
 * ## What to check by eye
 *
 *   · **7px corners** — the one radius above 4 in the product (§4.3) — and the
 *     shadow, one of three the product allows at all (§4.1). Nothing *inside*
 *     a dialog gets one.
 *   · **The backdrop** is `rgba(43,43,45,0.5)`: the page stays legible behind
 *     it and stops competing.
 *   · **Tab is trapped.** Hold Tab down and watch focus cycle inside the panel
 *     rather than walking into the page behind it.
 *   · **Escape closes it, and focus lands back on the button that opened it.**
 *     This is the one that needs the trigger to go through Radix — a modal
 *     `Content` restores focus to *its* trigger, so a button Radix does not
 *     know about leaves focus on `<body>`.
 *   · **200ms fade, and nothing else** (§1.7 `sheet`). No slide, no scale.
 *   · **Mobile 375** — `min(440px, 100%)` inside a 13.6px backdrop padding, so
 *     it never touches the edges and never overflows.
 */
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

/** §2.14 as drawn: 440px, a title, a line of body and two actions. */
export const Default: Story = {};

/** With the supporting line, which is also the dialog's `aria-describedby`. */
export const WithDescription: Story = {
  args: { description: 'The dealer is told, and the credit is consumed.' },
};

/**
 * The content-heavy case — 880px, a body long enough to scroll, and a footer
 * that stays put. This is the shape `LocationSelector` uses, and the reason
 * `className` overrides the width rather than the width being fixed at 440.
 */
export const Wide: Story = {
  args: { title: 'Select location', wide: true },
};

/** No footer: the ✕ and Escape are the whole of the way out. */
export const NoFooter: Story = { args: { withFooter: false } };
