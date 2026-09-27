export const VEHICLE_GALLERY_TEXT = {
  label: 'Photographs',
  noPhotos: 'Photographs coming soon',
  count: (index: number, total: number) => `${index + 1} / ${total}`,
  open: (index: number, total: number) => `View photograph ${index + 1} of ${total} fullscreen`,
  previous: 'Previous photograph',
  next: 'Next photograph',
  close: 'Close photographs',
  viewerTitle: (title: string) => `${title} — photographs`,
} as const;

export const PREVIOUS_GLYPH = '‹';
export const NEXT_GLYPH = '›';
