import { SkeletonLines } from '@/components/ui/primitives';

import { CONSOLE_LOADING_CARDS, CONSOLE_PAGE_LOADING_TEXT } from './console-page-loading.constants';

export function ConsolePageLoading() {
  return (
    <div
      data-loading=""
      role="status"
      aria-label={CONSOLE_PAGE_LOADING_TEXT.label}
      className="flex flex-col gap-[18px] px-4 py-[22px] md:px-8 md:py-[30px]"
    >
      <div className="flex flex-col gap-[10px]">
        <div className="skeleton h-[30px] w-[220px]" />
        <div className="skeleton w-[320px] max-w-full" />
      </div>
      <div className="flex flex-col gap-[14px] rounded-[14px] border border-(--color-divider) bg-white p-4">
        {Array.from({ length: CONSOLE_LOADING_CARDS }, (_, index) => (
          <SkeletonLines key={index} />
        ))}
      </div>
    </div>
  );
}
