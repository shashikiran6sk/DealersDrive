'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type DialogDescriptionTone = 'muted' | 'inverse';

const TONE_CLASS: Record<DialogDescriptionTone, string> = {
  muted: 'ink-muted',
  inverse: 'text-white/60',
};

export function DialogDescription({
  children,
  className,
  tone = 'muted',
}: {
  children: ReactNode;
  className?: string;
  tone?: DialogDescriptionTone;
}) {
  return (
    <RadixDialog.Description className={cn('mt-[2px] text-[13px]', TONE_CLASS[tone], className)}>
      {children}
    </RadixDialog.Description>
  );
}
