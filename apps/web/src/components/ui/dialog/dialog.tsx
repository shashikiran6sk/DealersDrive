'use client';

import * as RadixDialog from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';

import { DialogTitle } from './dialog-title';
import type { DialogProps } from './dialog.types';

const CLOSE_GLYPH = '✕';

/**
 * DESIGN-SPEC §2.14 — the modal dialog, and the product's only 7px radius.
 *
 * Radix underneath because the list of things a modal has to get right is
 * longer than it looks and every item on it is a bug only a screen-reader user
 * hits: focus into the panel, focus trapped, focus back on the trigger however
 * it closed, `aria-modal` with the rest of the document inert, body scroll
 * locked. What this component owns is the design — the backdrop tint, the 7px
 * corner and the one shadow (§4.1).
 *
 * Width is a default, not a rule: §2.14's `min(440px, 100%)` is right for a
 * confirmation, and a dialog whose content is a grid overrides it via
 * `className`. Open state is the caller's, because most dialogs close for a
 * reason of their own rather than because somebody pressed ✕.
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
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-backdrop" />
        <RadixDialog.Content
          /* Radix makes the document inert with `aria-hidden` and does not set this itself. */
          aria-modal="true"
          className={cn(
            /*
              The panel centres itself: Radix portals overlay and content as
              siblings, so `place-items:center` on the backdrop never reaches it,
              and the backdrop's `z-index:70` would otherwise paint over a panel
              at `auto`. `calc(100vw - 28px)` is §2.14's 13.6px edge padding.
            */
            'fixed top-1/2 left-1/2 z-71 max-w-[calc(100vw-28px)] -translate-x-1/2 -translate-y-1/2',
            /*
              `svh` not `vh`: on a phone the browser chrome is part of `vh`, so a
              dialog sized to it puts its own footer under the address bar.
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
            {/* Icon-only, so it needs a name (§4.15); 36×36 is the 44px minimum's nearest legal size. */}
            <RadixDialog.Close
              className="btn btn-secondary h-9 w-9 flex-none border-transparent p-0 text-[15px]"
              aria-label={closeLabel}
            >
              <span aria-hidden="true">{CLOSE_GLYPH}</span>
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
