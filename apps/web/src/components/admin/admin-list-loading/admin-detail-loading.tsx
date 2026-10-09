import { SkeletonLines } from '@/components/ui/primitives';

import { ADMIN_LOADING_TEXT } from './admin-list-loading.constants';

export function AdminDetailLoading() {
  return (
    <div
      className="mx-auto flex max-w-[1000px] flex-col gap-5 p-5"
      role="status"
      aria-label={ADMIN_LOADING_TEXT.label}
    >
      <div className="skeleton h-[28px] w-[260px]" />
      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(290px,1fr))] max-md:[grid-template-columns:repeat(auto-fit,minmax(min(290px,100%),1fr))]">
        {[0, 1].map((column) => (
          <div key={column} className="card gap-[14px] bg-white p-4">
            <SkeletonLines />
            <SkeletonLines />
          </div>
        ))}
      </div>
    </div>
  );
}
