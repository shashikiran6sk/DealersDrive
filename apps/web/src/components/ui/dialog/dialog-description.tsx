'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

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
