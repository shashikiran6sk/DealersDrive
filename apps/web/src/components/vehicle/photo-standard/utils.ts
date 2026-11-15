import { PHOTO_GUIDE_ASSETS } from './photo-standard.constants';

export type ShotImage = 'position' | 'result' | 'plan';

export function shotImage(number: number, kind: ShotImage): string {
  return `${PHOTO_GUIDE_ASSETS.base}/shot-${String(number).padStart(2, '0')}-${kind}.webp`;
}

export function shotNumberLabel(number: number): string {
  return String(number).padStart(2, '0');
}
