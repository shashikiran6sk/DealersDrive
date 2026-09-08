'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * DESIGN-SPEC §2.14 — the modal dialog, and the product's only 7px radius.
 *
 * ## Why this exists, and why it is Radix underneath
 *
 * `component-map.md` finding **D-C**: the baseline shipped `.dialog` and
 * `.dialog-backdrop` in `globals.css` with **zero consumers**, and drew its one
 * real dialog with `@radix-ui/react-dialog`. Two dialog strategies, one of them
 * dead — and the recommendation in the same document was that `Dialog` be among
 * the first shared components created, at the moment its first consumer lands.
 * That moment is **R22**, and this is it.
 *
 * Radix rather than a hand-rolled trap because the list of things a modal has
 * to get right is longer than it looks and every item on it is a bug a screen
 * reader user hits and nobody else does: focus into the panel on open, focus
 * *trapped* while it is there, focus back on the trigger when it closes —
 * whether by Escape, by the close button or by a click on the backdrop —
 * `aria-modal` with the rest of the document inert, and the body's scroll
 * locked so the page underneath does not slide about behind it. Writing that
 * again would be writing it worse; it is already a dependency, and it is the
 * strategy the baseline chose.
 *
 * What this component owns is the *design*: the backdrop tint, the 7px corner,
 * the one shadow, and the fact that `.dialog` finally has something rendering
 * it. §4.1 — one of three elements in the product allowed a shadow.
 *
 * ## The width is a default, not a rule
 *
 * §2.14 specifies `min(440px, 100%)`, which is right for the two dialogs the
 * spec draws — a confirmation and a rejection reason. A dialog whose content is
 * a grid is a different object, and passing `className` overrides the width the
 * way any Tailwind utility overrides a component class. `LocationDialog` does
 * exactly that; a confirm dialog should not.
 *
 * ## Motion
 *
 * §1.7 `sheet` — 200ms `ease-out`, fade only. `prefers-reduced-motion` zeroes
 * every duration globally in `globals.css`, so there is nothing to opt out of
 * here.
 *
 * ## Open state is controlled, and the trigger still goes through Radix
 *
 * `open`/`onOpenChange` are the caller's, because most dialogs close for a
 * reason of their own — a choice made, a request that succeeded — and not only
 * because somebody pressed ✕. The `trigger` still has to be Radix's; see the
 * prop for why, and for the bug that is not obvious until a keyboard user hits
 * it.
 */
export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  closeLabel = 'Close',
  className,
  contentClassName,
  header,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The control that opens it, rendered as-is through `Trigger asChild`.
   *
   * It goes through Radix rather than being a button the caller wires up
   * itself, and that is not a stylistic preference: a modal `Content` cancels
   * the focus-scope's own restore and focuses **its trigger** instead, so a
   * dialog opened by a button Radix does not know about closes with focus on
   * `<body>` — the next Tab starts from the top of the document. Passing the
   * button here is what makes "focus goes back where it came from" true, and it
   * gets `aria-haspopup="dialog"` and `aria-expanded` for nothing besides.
   */
  trigger: ReactNode;
  /** The accessible name. Rendered visibly unless `header` replaces it. */
  title: string;
  /** Optional supporting line under the title, and the accessible description. */
  description?: string;
  /** The icon-only close button's `aria-label` — §4.15 requires one. */
  closeLabel?: string;
  /** Overrides on the panel: width, padding, layout. */
  className?: string;
  /** The scrolling region between header and footer. */
  contentClassName?: string;
  /**
   * Replaces the default title block. It still has to *contain* the title —
   * pass `<DialogTitle>` — because `aria-labelledby` points at it.
   */
  header?: ReactNode;
  /** Pinned below the scrolling region. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-backdrop" />
        <RadixDialog.Content
          /*
            Radix makes the rest of the document inert with `aria-hidden` and
            does not set this itself. Both are the same claim; a checker looking
            for the attribute should find it, and a reader of this file should
            not have to know which of the two mechanisms is in play.
          */
          aria-modal="true"
          className={cn(
            /*
              The panel centres *itself*, and that is not a stylistic choice.
              §2.14 describes `.dialog-backdrop` as a centring grid with the
              `.dialog` inside it — but Radix portals the overlay and the
              content as **siblings**, so `place-items: center` on the backdrop
              never reaches the panel and it lands wherever the portal put it.
              The transform reproduces what the spec's grid would have done, and
              `calc(100vw - 28px)` is its 13.6px padding on each side, so the
              panel never touches the edge of a phone.

              `z-71` for the same reason: siblings, so the backdrop's `z-index:
              70` paints *over* a panel at `auto`, and the whole dialog renders
              behind its own 50 % tint — legible, greyed, and wrong in a way
              that is easy to read as a colour mistake rather than a stacking
              one.
            */
            'fixed top-1/2 left-1/2 z-71 max-w-[calc(100vw-28px)] -translate-x-1/2 -translate-y-1/2',
            /*
              Capped in `svh` rather than `vh`: on a phone the browser chrome is
              part of `vh`, so a dialog sized to it puts its own footer under
              the address bar.

              `p-0`/`gap-0` because the panel is header + scroller + footer, each
              with its own padding and separated by a hairline. §2.14's 13.6px
              padding is right for a dialog that is one block of prose.
            */
            'dialog max-h-[calc(100svh-28px)] gap-0 overflow-hidden p-0',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-(--color-divider) px-[18px] py-[14px]">
            <div className="min-w-0 flex-1">
              {header ?? (
                <>
                  <DialogTitle>{title}</DialogTitle>
                  {description ? (
                    <RadixDialog.Description className="mt-[2px] text-[13px] ink-muted">
                      {description}
                    </RadixDialog.Description>
                  ) : null}
                </>
              )}
            </div>
            {/*
              Icon-only, so it needs a name (§4.15). 36×36 is `btn-icon`, which
              is already the 44px minimum's nearest legal size in a header row —
              the hit area is padded out to it below 768 by the class itself.
            */}
            <RadixDialog.Close
              className="btn btn-secondary h-9 w-9 flex-none border-transparent p-0 text-[15px]"
              aria-label={closeLabel}
            >
              <span aria-hidden="true">✕</span>
            </RadixDialog.Close>
          </div>

          <div
            className={cn('min-h-0 flex-1 overflow-y-auto px-[18px] py-[16px]', contentClassName)}
          >
            {children}
          </div>

          {footer ? (
            <div className="flex flex-wrap items-center justify-between gap-[10px] border-t border-(--color-divider) bg-(--color-bg) px-[18px] py-[12px]">
              {footer}
            </div>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/**
 * The dialog's accessible name, and 16px/600 heading per §2.14.
 *
 * Exported because a custom `header` still has to carry it: Radix points
 * `aria-labelledby` at this element, and a dialog with no name is announced as
 * "dialog" and nothing else.
 */
export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <RadixDialog.Title className={cn('font-heading text-[16px] font-semibold', className)}>
      {children}
    </RadixDialog.Title>
  );
}

/** The supporting line, and the dialog's `aria-describedby`. */
export function DialogDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Description className={cn('mt-[2px] text-[13px] ink-muted', className)}>
      {children}
    </RadixDialog.Description>
  );
}
