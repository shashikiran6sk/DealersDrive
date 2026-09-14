'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * The dialog's accessible name, and 16px/600 heading per §2.14. Exported
 * because a custom `header` still has to carry it: Radix points
 * `aria-labelledby` at this element.
 */
export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <RadixDialog.Title className={cn('font-heading text-[16px] font-semibold', className)}>
      {children}
    </RadixDialog.Title>
  );
}
