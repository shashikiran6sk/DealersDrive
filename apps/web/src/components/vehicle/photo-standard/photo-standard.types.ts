import type { StandardPhotoSlot } from '@dealers-drive/contracts';

export type Posture = 'stand' | 'kneel' | 'inside';

export interface Point {
  x: number;
  y: number;
}

export interface ShotGuide {
  slot: StandardPhotoSlot;
  number: number;
  title: string;
  where: string;
  posture: Posture;
  how: string;
  check: string;
  photographer: Point;
  target: Point;
  openDoor?: 'front-left' | 'rear-left';
}
