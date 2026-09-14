import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Blueprint } from './blueprint';

export interface StatePanelProps {
  title: string;
  message: string;
  action?: ReactNode;
  className?: string;
  titleClassName?: string;
  role?: 'alert';
}

/** The shell `EmptyState` and `ErrorState` share — blueprint, title, one sentence, one action. */
export function StatePanel({
  title,
  message,
  action,
  className,
  titleClassName,
  role,
}: StatePanelProps) {
  return (
    <Blueprint className={cn('bg-white px-6 py-14 text-center', className)} role={role}>
      <div className={cn('font-heading text-[22px] font-semibold', titleClassName)}>{title}</div>
      <p className="mx-auto mt-[7px] max-w-[46ch] text-[14px] ink-muted">{message}</p>
      {action ? <div className="mt-[18px] flex justify-center gap-2">{action}</div> : null}
    </Blueprint>
  );
}
