import type { StandardPhotoSlot } from '@dealers-drive/contracts';

export type Pose = 'kneel' | 'kneelAtDoor' | 'sitInBack' | 'sitInDriverSeat';

export interface ShotFact {
  value: string;
  note: string;
}

export interface ShotGuide {
  slot: StandardPhotoSlot;
  number: number;
  title: string;
  side: string;
  purpose: string;
  pose: Pose;
  height: ShotFact;
  distance: ShotFact;
  hold: ShotFact;
  steps: readonly string[];
  checks: readonly string[];
  avoid: string;
}

export interface PoseGuide {
  pose: Pose;
  title: string;
  body: string;
  image: string;
}
