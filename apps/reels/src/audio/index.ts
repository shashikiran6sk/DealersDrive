import { REEL_DURATION, REEL_FPS, SCENE_FRAMES } from '../reel/reel.constants';

import { renderBed } from './score';
import { renderWhoosh } from './sfx';
import { encodeWav } from './wav';

export const SAMPLE_RATE = 44100;
export const BED_BPM = 120;

export function reelBedWav(): Uint8Array {
  return encodeWav(
    renderBed({
      seconds: REEL_DURATION / REEL_FPS,
      bpm: BED_BPM,
      sampleRate: SAMPLE_RATE,
      dropIn: SCENE_FRAMES.opening / REEL_FPS,
      dropOut: (REEL_DURATION - SCENE_FRAMES.closing) / REEL_FPS,
    }),
  );
}

export function whooshWav(): Uint8Array {
  return encodeWav(renderWhoosh(SAMPLE_RATE));
}
