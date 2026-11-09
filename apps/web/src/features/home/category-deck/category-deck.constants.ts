export const DECK_TEXT = {
  title: 'Shop the way you search',
  body: 'Five quick ways into the marketplace, each with the cars dealers have listed in it right now.',
  featured: 'Featured',
  seeEveryCar: 'See every car',
  position: (position: number, total: number) =>
    `${String(position + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
} as const;

export const CATEGORY_ICON_TEXT = {
  gears: 'PRN',
  drive: 'D',
  price: '₹10L',
} as const;

export const DECK_HEADING_ID = 'home-categories-heading';

export const DECK_STICKY_OFFSET_PX = 20;

export const DECK_STACK_STEP_PX = 16;
