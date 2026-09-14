import { cn } from '@/lib/cn';

/** Static bars at the widths DESIGN-SPEC §2.20 specifies. No shimmer. */
export function SkeletonLines({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-[6px]', className)}>
      <div className="skeleton w-[70%]" />
      <div className="skeleton w-[46%]" />
      <div className="skeleton w-[88%]" />
    </div>
  );
}
