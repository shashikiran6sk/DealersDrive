import { cyclic, sampleAt } from '../lib/pick';

import { crash, bass, boom, clap, duck, hat, kick, pad, pluck, riser } from './instruments';
import { createMix, normalize, softClip, type Mix } from './mix';
import { noiseSource } from './prng';

export type BedOptions = {
  seconds: number;
  bpm: number;
  sampleRate: number;
  dropIn: number;
  dropOut: number;
  seed?: number;
};

export type Chord = {
  root: number;
  notes: readonly number[];
};

export const PROGRESSION: readonly Chord[] = [
  { root: 45, notes: [57, 60, 64, 69] },
  { root: 41, notes: [57, 60, 65, 69] },
  { root: 48, notes: [55, 60, 64, 67] },
  { root: 43, notes: [55, 59, 62, 67] },
];

export const FINAL_CHORD: Chord = { root: 48, notes: [55, 60, 64, 67, 72] };

const ARP_PATTERN = [0, 1, 2, 3, 2, 1, 2, 3];
const BED_PEAK = 0.9;

function chordAt(beat: number): Chord {
  return cyclic(PROGRESSION, Math.floor(beat / 4), FINAL_CHORD);
}

export function renderBed(options: BedOptions): Mix {
  const { seconds, bpm, sampleRate, dropIn, dropOut, seed = 2026 } = options;
  const beat = 60 / bpm;
  const sixteenth = beat / 4;
  const drums = createMix(seconds, sampleRate);
  const tonal = createMix(seconds, sampleRate);
  const noise = noiseSource(seed);
  const kicks: number[] = [];
  const totalBeats = Math.ceil(seconds / beat);
  const filterOpen = (t: number) =>
    t < dropIn ? 500 + 1700 * (t / dropIn) ** 2 : t < dropOut ? 2400 : 1800;

  riser(drums, 0, dropIn, 0.8, noise);
  crash(drums, dropIn, 0.5, noise);

  for (let index = 0; index < totalBeats; index += 1) {
    const t = index * beat;
    const chord = chordAt(index);
    const playing = t >= dropIn - 1e-6 && t < dropOut - 1e-6;

    if (index % 4 === 0 && t < dropOut) {
      const length = Math.min(4 * beat, dropOut - t);
      pad(tonal, t, length, chord.notes, 0.1, filterOpen);
    }

    if (t < dropOut) {
      for (let step = 0; step < 4; step += 1) {
        const tone = cyclic(chord.notes, cyclic(ARP_PATTERN, index * 4 + step, 0), 60);
        const level = playing ? 0.26 : 0.18;
        pluck(tonal, t + step * sixteenth, tone + 12, level, step % 2 === 0 ? -0.35 : 0.35);
      }
    }

    if (!playing) continue;
    kick(drums, t, 0.75, noise);
    kicks.push(t);
    if (index % 2 === 1) clap(drums, t, 0.9, noise);
    hat(drums, t + beat / 2, 0.6, 0.035, 0.2, noise);
    hat(drums, t + sixteenth, 0.24, 0.02, -0.3, noise);
    hat(drums, t + 3 * sixteenth, 0.24, 0.02, 0.3, noise);
    bass(tonal, t + beat / 2, beat / 2 - 0.02, chord.root + 12, 0.34);
    if (index % 4 === 0) bass(tonal, t, beat / 4, chord.root, 0.26);
  }

  boom(drums, dropOut, 0.9);
  crash(drums, dropOut, 0.5, noise);
  kicks.push(dropOut);
  pad(tonal, dropOut, seconds - dropOut, FINAL_CHORD.notes, 0.11, filterOpen);
  FINAL_CHORD.notes.forEach((note, index) =>
    pluck(tonal, dropOut + index * sixteenth, note + 12, 0.24, index % 2 === 0 ? -0.3 : 0.3),
  );

  duck(tonal, kicks, 0.55, 0.11);
  for (let index = 0; index < drums.left.length; index += 1) {
    drums.left[index] = sampleAt(drums.left, index) + sampleAt(tonal.left, index);
    drums.right[index] = sampleAt(drums.right, index) + sampleAt(tonal.right, index);
  }
  return normalize(softClip(normalize(drums, 1), 1.4), BED_PEAK);
}
