import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type TagVariant = 'neutral' | 'accent' | 'outline';

const VARIANT_CLASS: Record<TagVariant, string> = {
  neutral: 'tag-neutral',
  accent: 'tag-accent',
  outline: 'tag-outline',
};

export interface TagProps {
  variant?: TagVariant;
  className?: string;
  children: ReactNode;
}

export function Tag({ variant = 'neutral', className, children }: TagProps) {
  return <span className={cn('tag', VARIANT_CLASS[variant], className)}>{children}</span>;
}
