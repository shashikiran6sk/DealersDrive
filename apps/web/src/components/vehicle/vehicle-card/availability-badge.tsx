import { cn } from '@/lib/cn';

export function AvailabilityBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'absolute bottom-[10px] left-[10px] z-[2] border border-(--color-warn) bg-white px-[8px] py-[3px] text-[11px] font-semibold uppercase tracking-[0.08em] text-(--color-warn)',
        className,
      )}
    >
      {label}
    </span>
  );
}
