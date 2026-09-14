import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/cn';

export function Input({ className, ...props }: ComponentPropsWithRef<'input'>) {
  return <input className={cn('input', className)} {...props} />;
}
