import { SkeletonLines } from '@/components/ui/primitives';

export function VehicleCardSkeleton() {
  return (
    <div
      className="card h-full gap-0 overflow-hidden rounded-[15px] bg-white p-0"
      aria-hidden="true"
    >
      <div className="aspect-[1.6] border-b border-(--color-divider) bg-(--color-neutral-150) sm:aspect-[1.75]" />
      <div className="px-[13px] pt-[12px] pb-[14px]">
        <SkeletonLines />
      </div>
    </div>
  );
}
