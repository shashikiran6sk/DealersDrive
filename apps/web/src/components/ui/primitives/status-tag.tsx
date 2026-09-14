import type { StatusTone } from '@dealers-drive/contracts';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

const TONE_CLASS: Record<StatusTone, string> = {
  ok: 'tag-ok',
  warn: 'tag-warn',
  err: 'tag-err',
  neutral: 'tag-neutral',
  accent: 'tag-accent',
};

export interface StatusTagProps {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}

export function StatusTag({ tone, children, className }: StatusTagProps) {
  return <span className={cn('tag', TONE_CLASS[tone], className)}>{children}</span>;
}
