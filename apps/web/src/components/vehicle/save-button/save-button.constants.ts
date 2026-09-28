export const SAVE_BUTTON_TEXT = {
  save: (title: string) => `Save ${title}`,
  unsave: (title: string) => `Remove ${title} from saved vehicles`,
  saveShort: 'Save vehicle',
  unsaveShort: 'Remove from saved vehicles',
  saveLabel: 'Save',
  savedLabel: 'Saved',
} as const;

export const HEART_EMPTY = '♡';

export const HEART_FULL = '♥';
