import { SkeletonLines } from '@/components/ui/primitives';

import { SUPPORT_LOADING_LABEL } from './support-requests.constants';

export function SupportRequestsLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-[760px] flex-col gap-[14px] px-4 pt-[22px] pb-[60px] sm:px-6"
      role="status"
      aria-label={SUPPORT_LOADING_LABEL}
    >
      <div className="skeleton h-[32px] w-[220px]" />
      {[0, 1, 2].map((row) => (
        <div key={row} className="card bg-white p-[16px]">
          <SkeletonLines />
        </div>
      ))}
    </div>
  );
}
