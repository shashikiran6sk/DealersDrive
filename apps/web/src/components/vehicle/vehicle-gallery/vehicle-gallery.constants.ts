export const VEHICLE_GALLERY_TEXT = {
  noPhotos: 'Photographs coming soon',
  count: (index: number, total: number) => `${index + 1} / ${total}`,
  thumbsLabel: 'Photographs',
  showLabel: (index: number, total: number) => `Show photograph ${index + 1} of ${total}`,
} as const;
