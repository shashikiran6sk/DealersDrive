import type { StatusTone } from '@dealers-drive/contracts';

import { cn } from '@/lib/cn';

import { Blueprint } from './blueprint';

const DELTA_TONE_CLASS: Record<StatusTone, string> = {
  ok: 'text-(--color-ok)',
  warn: 'text-(--color-warn)',
  err: 'text-(--color-err)',
  neutral: 'ink-subtle',
  accent: 'ink-subtle',
};

export interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: StatusTone;
  className?: string;
}

/** DESIGN-SPEC §2.12 — blueprint, eyebrow, tabular stat, delta line. */
export function StatCard({ label, value, delta, deltaTone = 'neutral', className }: StatCardProps) {
  return (
    <Blueprint className={cn('bg-white p-4', className)}>
      <div className="eyebrow">{label}</div>
      <div className="font-heading text-[34px] font-bold leading-[1.15] tnum">{value}</div>
      {delta ? <div className={cn('text-[12px]', DELTA_TONE_CLASS[deltaTone])}>{delta}</div> : null}
    </Blueprint>
  );
}
