import { SkeletonLines } from '@/components/ui/primitives';

import { GALLERY_THUMBS, VEHICLE_PAGE_LOADING_TEXT } from './vehicle-page-loading.constants';

export function VehiclePageLoading() {
  return (
    <div
      data-loading=""
      role="status"
      aria-label={VEHICLE_PAGE_LOADING_TEXT.label}
      className="mx-auto max-w-[1280px] px-4 pt-[24px] pb-[88px] sm:px-6 lg:pb-[64px]"
    >
      <div className="mb-[14px] h-[40px] w-[96px] rounded-[10px] bg-(--color-neutral-150)" />
      <div className="grid gap-[30px] lg:grid-cols-[1.35fr_1fr]">
        <div className="flex min-w-0 flex-col gap-[12px]">
          <div className="aspect-[4/3] w-full rounded-[14px] bg-(--color-neutral-150)" />
          <div className="flex gap-[10px] overflow-hidden">
            {Array.from({ length: GALLERY_THUMBS }, (_, index) => (
              <div
                key={index}
                className="aspect-[4/3] flex-[0_0_108px] rounded-[10px] bg-(--color-neutral-150) max-sm:flex-[0_0_88px]"
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-[16px]">
          <div className="flex flex-col gap-[10px]">
            <div className="skeleton h-[22px] w-[52px]" />
            <div className="skeleton h-[30px] w-[80%]" />
            <div className="skeleton w-[60%]" />
          </div>
          <div className="card gap-[10px] bg-white p-[16px]">
            <div className="skeleton w-[90px]" />
            <div className="skeleton h-[34px] w-[60%]" />
          </div>
          <div className="h-[44px] rounded-[10px] bg-(--color-neutral-200)" />
          <div className="card bg-white p-[16px]">
            <SkeletonLines />
          </div>
        </div>
      </div>
    </div>
  );
}
