import type { YardPhotoPaths } from '@/features/auth/yard-photo-uploader/yard-photo-uploader.constants';

export function salesDocumentBase(dealerId: string): string {
  return `/api/sales/dealers/${encodeURIComponent(dealerId)}/documents`;
}

export function salesYardPhotoPaths(dealerId: string): YardPhotoPaths {
  const base = `/api/sales/dealers/${encodeURIComponent(dealerId)}/yard-photo`;
  return { presign: `${base}/presign`, commit: `${base}/commit`, remove: base };
}
