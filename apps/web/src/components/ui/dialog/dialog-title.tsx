'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <RadixDialog.Title className={cn('font-heading text-[16px] font-semibold', className)}>
      {children}
    </RadixDialog.Title>
  );
}
