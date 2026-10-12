export const DEALER_GALLERY_TEXT = {
  heading: 'Photos of the dealership',
  listLabel: (brandName: string) => `Photos of ${brandName}`,
  photoAlt: (brandName: string, position: number, caption: string | null) =>
    caption ? `${brandName} — ${caption}` : `${brandName} dealership, photo ${position}`,
} as const;
