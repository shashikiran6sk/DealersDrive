'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

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
  trigger: ReactNode;
  title: string;
  description?: string;
  closeLabel?: string;
  className?: string;
  contentClassName?: string;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-backdrop" />
        <RadixDialog.Content
          aria-modal="true"
          className={cn(
            'fixed top-1/2 left-1/2 z-71 max-w-[calc(100vw-28px)] -translate-x-1/2 -translate-y-1/2',
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

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <RadixDialog.Title className={cn('font-heading text-[16px] font-semibold', className)}>
      {children}
    </RadixDialog.Title>
  );
}

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
