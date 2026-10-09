import { DashboardMetrics } from '@/components/dealer/dashboard-metrics';
import { SkeletonLines } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="flex flex-col gap-[18px] px-4 py-[22px] md:px-8 md:py-[30px]">
      <div aria-hidden="true" className="skeleton h-[30px] w-[220px] max-w-full" />
      <DashboardMetrics loading />
      <SkeletonLines />
    </div>
  );
}
