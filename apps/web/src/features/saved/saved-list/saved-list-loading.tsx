import { VehicleCardSkeleton } from '@/components/vehicle/vehicle-card';

import { SAVED_LIST_LOADING } from './saved-list.constants';

export function SavedListLoading() {
  return (
    <div
      data-loading=""
      role="status"
      aria-label={SAVED_LIST_LOADING.label}
      className="mx-auto flex w-full max-w-[1280px] flex-col gap-[18px] px-4 pt-[22px] pb-[60px] sm:px-6"
    >
      <div className="skeleton h-[32px] w-[200px]" />
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(262px,1fr))] max-md:[grid-template-columns:repeat(auto-fill,minmax(min(262px,100%),1fr))]">
        {Array.from({ length: SAVED_LIST_LOADING.cards }, (_, index) => (
          <VehicleCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
