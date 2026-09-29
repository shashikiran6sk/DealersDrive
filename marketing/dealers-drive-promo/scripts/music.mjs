import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PROMO } from './environment.mjs';

// Original score: no samples, loops, recordings, or third-party composition.
// Dmaj9 – Bm7 – Gmaj9 – Asus2, 96 BPM; sparse plucks, warm pad, bass and brushed pulse.
const sr = 48000,
  duration = 120,
  n = sr * duration;
const left = new Float32Array(n),
  right = new Float32Array(n);
const beat = 60 / 96,
  bar = beat * 4;
const chords = [
  [50, 57, 61, 66, 69],
  [47, 54, 57, 62, 66],
  [43, 50, 54, 59, 62],
  [45, 52, 57, 59, 64],
];
const hz = (note) => 440 * 2 ** ((note - 69) / 12);
let rng = 29092026;
const noise = () => {
  rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
  return rng / 2147483648 - 1;
};
function tone(start, length, note, gain, kind, pan = 0) {
  const a = Math.floor(start * sr),
    count = Math.min(Math.floor(length * sr), n - a),
    f = hz(note);
  for (let i = 0; i < count; i++) {
    const t = i / sr,
      p = t / length;
    const envelope =
      kind === 'pad'
        ? Math.min(t / 0.75, 1) * (1 - Math.max(0, (p - 0.65) / 0.35))
        : (1 - Math.exp(-t * 120)) * Math.exp(-t * (kind === 'bass' ? 2 : 3.7));
    const wave =
      Math.sin(2 * Math.PI * f * t) +
      0.22 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t * 2) +
      0.07 * Math.sin(2 * Math.PI * f * 3 * t);
    const v = wave * envelope * gain;
    left[a + i] += v * (1 - pan * 0.35);
    right[a + i] += v * (1 + pan * 0.35);
  }
}
for (let b = 0; b < Math.ceil(duration / bar); b++) {
  const start = b * bar,
    chord = chords[Math.floor(b / 2) % 4],
    rise = Math.min(1, b / 9);
  chord
    .slice(1)
    .forEach((note, i) => tone(start, bar * 1.4, note, 0.015 + rise * 0.011, 'pad', (i - 1.5) / 2));
  tone(start, bar * 0.75, chord[0] - 12, 0.065, 'bass');
  if (b > 2)
    for (let k = 0; k < 4; k++)
      tone(
        start + k * beat,
        chord.length ? 1.3 : 1,
        chord[2 + (k % 3)] + 12,
        0.022 + rise * 0.012,
        'pluck',
        k % 2 ? -0.45 : 0.45,
      );
  if (b > 6)
    for (let k = 0; k < 8; k++) {
      const at = Math.floor((start + (k * beat) / 2) * sr);
      for (let j = 0; j < sr * 0.045 && at + j < n; j++) {
        const v = noise() * 0.013 * Math.exp(-j / (sr * 0.008));
        left[at + j] += v;
        right[at + j] += v * 0.75;
      }
    }
}
// Wide, quiet delays give the plucks space without masking narration.
for (let i = Math.floor(sr * 0.31); i < n; i++) {
  left[i] += right[i - Math.floor(sr * 0.31)] * 0.12;
  right[i] += left[i - Math.floor(sr * 0.47)] * 0.09 || 0;
}
const wav = Buffer.alloc(44 + n * 4);
wav.write('RIFF');
wav.writeUInt32LE(36 + n * 4, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(sr, 24);
wav.writeUInt32LE(sr * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(n * 4, 40);
for (let i = 0; i < n; i++) {
  const t = i / sr,
    fade = Math.min(1, t / 3, (duration - t) / 4);
  wav.writeInt16LE(Math.round(Math.tanh(left[i]) * fade * 26000), 44 + i * 4);
  wav.writeInt16LE(Math.round(Math.tanh(right[i]) * fade * 26000), 46 + i * 4);
}
await mkdir(resolve(PROMO, 'assets/audio'), { recursive: true });
await writeFile(resolve(PROMO, 'assets/audio/digital-showroom-original.wav'), wav);
console.log('Original 120-second stereo music master written.');
