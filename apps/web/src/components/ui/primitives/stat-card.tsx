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
  inverse?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  inverse = false,
  className,
}: StatCardProps) {
  return (
    <Blueprint
      className={cn(
        'flex min-h-[120px] flex-col justify-between rounded-[14px] p-5',
        inverse ? 'border-(--color-accent) bg-(--color-accent) text-white' : 'bg-white',
        className,
      )}
    >
      <div className={cn('text-[12px] font-bold', inverse ? 'text-white/75' : 'ink-muted')}>
        {label}
      </div>
      <div className="mt-[6px] font-heading text-[30px] font-extrabold leading-[1.15] tracking-[-0.03em] tnum">
        {value}
      </div>
      {delta ? (
        <div className={cn('text-[12px]', inverse ? 'text-white/75' : DELTA_TONE_CLASS[deltaTone])}>
          {delta}
        </div>
      ) : null}
    </Blueprint>
  );
}
