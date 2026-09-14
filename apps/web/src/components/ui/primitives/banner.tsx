import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type BannerTone = 'ok' | 'warn' | 'err';

const TONE_CLASS: Record<BannerTone, string> = {
  ok: 'bg-(--color-ok-bg) text-(--color-ok) border-[color-mix(in_srgb,#0f7a5a_30%,transparent)]',
  warn: 'bg-(--color-warn-bg) text-(--color-warn) border-[color-mix(in_srgb,#a15c00_30%,transparent)]',
  err: 'bg-(--color-err-bg) text-(--color-err) border-[color-mix(in_srgb,#b3261e_30%,transparent)]',
};

export interface BannerProps {
  tone: BannerTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** DESIGN-SPEC §2.15 — cleared on navigation, never auto-dismissed. */
export function Banner({ tone, title, children, action, className }: BannerProps) {
  return (
    <div
      className={cn('border px-[14px] py-[10px] text-[13px]', TONE_CLASS[tone], className)}
      role="status"
    >
      {title ? <div className="mb-[3px] text-[14px] font-semibold">{title}</div> : null}
      {children ? <div className="ink-body">{children}</div> : null}
      {action ? <div className="mt-[9px]">{action}</div> : null}
    </div>
  );
}
