import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/cn';

/**
 * `ComponentPropsWithRef` rather than `InputHTMLAttributes` so a caller can hold
 * the element (**R37**): `ServiceInput` returns focus to the draft box after
 * every chip, and in React 19 `ref` is an ordinary prop on a function component.
 */
export function Input({ className, ...props }: ComponentPropsWithRef<'input'>) {
  return <input className={cn('input', className)} {...props} />;
}
