import { SkeletonLines } from '@/components/ui/primitives';

import { CUSTOMER_ENQUIRIES_LOADING } from './customer-enquiries.constants';

export function CustomerEnquiriesLoading() {
  return (
    <div
      data-loading=""
      role="status"
      aria-label={CUSTOMER_ENQUIRIES_LOADING.label}
      className="mx-auto flex w-full max-w-[760px] flex-col gap-[14px] px-4 pt-[22px] pb-[60px] sm:px-6"
    >
      <div className="skeleton h-[32px] w-[220px]" />
      {Array.from({ length: CUSTOMER_ENQUIRIES_LOADING.rows }, (_, row) => (
        <div key={row} className="card bg-white p-[16px]">
          <SkeletonLines />
        </div>
      ))}
    </div>
  );
}
