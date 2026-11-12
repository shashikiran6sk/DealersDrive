import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function ChecklistItem({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden
        className={cn(
          'mt-[1px] inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[11px] font-bold text-white',
          ok ? 'bg-(--color-ok)' : 'bg-(--color-warn)',
        )}
      >
        {ok ? '✓' : '!'}
      </span>
      <span className="flex flex-wrap items-center gap-2">{children}</span>
    </li>
  );
}
