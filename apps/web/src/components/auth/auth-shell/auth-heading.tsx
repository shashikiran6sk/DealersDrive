import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function AuthHeading({
  title,
  children,
  visuallyHidden = false,
}: {
  title: string;
  children?: ReactNode;
  visuallyHidden?: boolean;
}) {
  return (
    <div className={cn('mb-[26px]', visuallyHidden && 'sr-only')}>
      <h1 className="font-heading text-[30px] font-extrabold leading-[1.1] tracking-[-0.035em]">
        {title}
      </h1>
      {children ? (
        <p className="mt-[10px] text-[15px] leading-[1.6] ink-muted">{children}</p>
      ) : null}
    </div>
  );
}
