import { SkeletonLines } from '@/components/ui/primitives';

export function VehicleCardSkeleton() {
  return (
    <div className="card gap-0 overflow-hidden bg-white p-0" aria-hidden="true">
      <div className="aspect-[4/3] border-b border-(--color-divider) bg-(--color-neutral-200)" />
      <div className="px-[13px] pt-[12px] pb-[14px]">
        <SkeletonLines />
      </div>
    </div>
  );
}
