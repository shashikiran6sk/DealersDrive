'use client';

import * as RadixDialog from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';

import { DialogTitle } from './dialog-title';
import type { DialogProps } from './dialog.types';
import { DIALOG_VARIANTS } from './dialog.variants';

const CLOSE_GLYPH = '✕';

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
  variant = 'card',
  onCloseAutoFocus,
}: DialogProps) {
  const classes = DIALOG_VARIANTS[variant];

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={classes.overlay} />
        <RadixDialog.Content
          aria-modal="true"
          className={cn(classes.content, className)}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className={classes.header}>
            <div className="min-w-0 flex-1">
              {header ?? (
                <>
                  <DialogTitle className={classes.title}>{title}</DialogTitle>
                  {description ? (
                    <RadixDialog.Description className={classes.description}>
                      {description}
                    </RadixDialog.Description>
                  ) : null}
                </>
              )}
            </div>
            <RadixDialog.Close className={classes.close} aria-label={closeLabel}>
              {classes.closeShowsLabel ? <span>{closeLabel}</span> : null}
              <span aria-hidden="true">{CLOSE_GLYPH}</span>
            </RadixDialog.Close>
          </div>

          <div className={cn(classes.body, contentClassName)}>{children}</div>

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
