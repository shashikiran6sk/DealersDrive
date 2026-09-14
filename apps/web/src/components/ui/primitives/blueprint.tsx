import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

import { Corners } from './corners';

export type BlueprintElement = 'div' | 'section' | 'article';

export type BlueprintProps = HTMLAttributes<HTMLElement> & { as?: BlueprintElement };

export function Blueprint({ className, children, as: Tag = 'div', ...props }: BlueprintProps) {
  return (
    <Tag className={cn('blueprint', className)} {...props}>
      <Corners />
      {children}
    </Tag>
  );
}
