import { SkeletonLines } from '@/components/ui/primitives';

import { ADMIN_LOADING_ROWS, ADMIN_LOADING_TEXT } from './admin-list-loading.constants';

export function AdminListLoading() {
  return (
    <div className="flex flex-col gap-4 p-5" role="status" aria-label={ADMIN_LOADING_TEXT.label}>
      <div className="skeleton h-[30px] w-[180px]" />
      <div className="skeleton h-[36px] w-full max-w-[520px]" />
      <div className="flex flex-col gap-[14px] rounded-[14px] border border-(--color-divider) bg-white p-4">
        {Array.from({ length: ADMIN_LOADING_ROWS }, (_, index) => (
          <SkeletonLines key={index} />
        ))}
      </div>
    </div>
  );
}
