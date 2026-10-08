import { VehicleCardSkeleton } from '@/components/vehicle/vehicle-card';

import { DEALER_LOADING_CARDS, DEALER_PAGE_LOADING_TEXT } from './dealer-page-loading.constants';

export function DealerPageLoading() {
  return (
    <div data-loading="" role="status" aria-label={DEALER_PAGE_LOADING_TEXT.label}>
      <div className="border-b border-(--color-divider) bg-white">
        <div className="mx-auto max-w-[1280px] px-4 pt-[22px] sm:px-6">
          <div className="mb-[14px] h-[40px] w-[132px] rounded-[10px] bg-(--color-neutral-150)" />
        </div>
        <div className="mx-auto flex max-w-[1280px] items-start gap-[18px] px-6 pb-[20px]">
          <div className="h-[72px] w-[72px] flex-none rounded-[14px] bg-(--color-neutral-150) max-md:h-[60px] max-md:w-[60px]" />
          <div className="flex min-w-0 flex-1 flex-col gap-[10px] pt-[6px]">
            <div className="skeleton h-[30px] w-[280px] max-w-full" />
            <div className="skeleton w-[60%]" />
            <div className="skeleton w-[45%]" />
          </div>
        </div>
        <div className="mx-auto max-w-[1280px] px-4 pb-[20px] sm:px-6">
          <div className="h-[440px] rounded-[14px] bg-(--color-neutral-150) max-lg:h-[340px] max-md:h-[240px]" />
        </div>
      </div>
      <div className="mx-auto grid max-w-[1280px] gap-[18px] px-6 pt-6 [grid-template-columns:repeat(auto-fill,minmax(262px,1fr))] max-md:[grid-template-columns:repeat(auto-fill,minmax(min(262px,100%),1fr))]">
        {Array.from({ length: DEALER_LOADING_CARDS }, (_, index) => (
          <VehicleCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
