import { cn } from '@/lib/cn';

export function AvailabilityBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'absolute bottom-[10px] left-[10px] z-[2] rounded-full bg-(--color-warn-bg) px-[10px] py-[4px] text-[11px] font-extrabold text-(--color-warn)',
        className,
      )}
    >
      {label}
    </span>
  );
}
