'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** A state filter. Navigation, not a selection — see the call site. */
export function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'btn text-[12px] px-[10px] py-[4px]',
        pressed ? 'btn-primary' : 'btn-secondary',
      )}
    >
      {children}
    </button>
  );
}
