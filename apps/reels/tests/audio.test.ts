import { describe, expect, it } from 'vitest';

import { BED_BPM, reelBedWav, SAMPLE_RATE, whooshWav } from '../src/audio';
import { Svf } from '../src/audio/filter';
import { duck, midiToHz } from '../src/audio/instruments';
import { addVoice, createMix, normalize, panGains, peak, softClip } from '../src/audio/mix';
import { noiseSource, seededRandom } from '../src/audio/prng';
import { renderBed } from '../src/audio/score';
import { renderWhoosh, WHOOSH_PEAK_AT } from '../src/audio/sfx';
import { encodeWav } from '../src/audio/wav';

const SHORT = { seconds: 4, bpm: BED_BPM, sampleRate: 8000, dropIn: 1, dropOut: 3 };

function rms(samples: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let index = from; index < to; index += 1) sum += (samples[index] ?? 0) ** 2;
  return Math.sqrt(sum / Math.max(1, to - from));
}

describe('prng', () => {
  it('is deterministic per seed and stays in range', () => {
    const a = seededRandom(1);
    const b = seededRandom(1);
    const values = Array.from({ length: 100 }, () => a());
    expect(values).toEqual(Array.from({ length: 100 }, () => b()));
    values.forEach((value) => expect(value).toBeGreaterThanOrEqual(0));
    values.forEach((value) => expect(value).toBeLessThan(1));
    const noise = noiseSource(3);
    expect(Math.abs(noise())).toBeLessThanOrEqual(1);
  });
});

describe('Svf', () => {
  it('stays stable at any cutoff, including above Nyquist', () => {
    const filter = new Svf(8000);
    const noise = noiseSource(9);
    for (let index = 0; index < 4000; index += 1) {
      filter.process(noise(), index % 2 === 0 ? 20 : 20000, 0.7);
      expect(Number.isFinite(filter.low + filter.band + filter.high)).toBe(true);
    }
  });
});

describe('mix', () => {
  it('pans with equal power', () => {
    const [left, right] = panGains(0);
    expect(left ** 2 + right ** 2).toBeCloseTo(1);
    expect(panGains(-5)).toEqual(panGains(-1));
  });

  it('adds mono and stereo voices and ignores samples outside the mix', () => {
    const mix = createMix(1, 100);
    addVoice(mix, -0.5, 2, () => 1);
    addVoice(mix, 0, 1, (): [number, number] => [0.5, -0.5]);
    expect(mix.left[0]).toBeCloseTo(Math.SQRT1_2 + 0.5);
    expect(mix.right[0]).toBeCloseTo(Math.SQRT1_2 - 0.5);
  });

  it('normalizes to a target peak and leaves silence alone', () => {
    const mix = createMix(1, 10);
    expect(normalize(mix, 0.9)).toBe(mix);
    mix.left[3] = 2;
    expect(peak(normalize(mix, 0.5))).toBeCloseTo(0.5);
    expect(peak(softClip(mix, 10))).toBeLessThan(1);
  });
});

describe('duck', () => {
  it('dips right after a kick and recovers', () => {
    const mix = createMix(1, 1000);
    mix.left.fill(1);
    mix.right.fill(1);
    duck(mix, [0.5], 0.6, 0.05);
    expect(mix.left[100]).toBeCloseTo(1);
    expect(mix.left[500]).toBeCloseTo(0.4);
    expect(mix.left[900]).toBeGreaterThan(0.99);
  });
});

describe('midiToHz', () => {
  it('tunes A4 to 440 Hz', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(57)).toBeCloseTo(220);
  });
});

describe('renderBed', () => {
  it('is the requested length, deterministic and below full scale', () => {
    const first = renderBed(SHORT);
    const second = renderBed(SHORT);
    expect(first.left).toHaveLength(SHORT.seconds * SHORT.sampleRate);
    expect(first.left).toEqual(second.left);
    expect(peak(first)).toBeLessThanOrEqual(0.9 + 1e-6);
  });

  it('is louder once the beat drops than during the intro', () => {
    const bed = renderBed(SHORT);
    const rate = SHORT.sampleRate;
    expect(rms(bed.left, 1.2 * rate, 2.8 * rate)).toBeGreaterThan(rms(bed.left, 0, 0.8 * rate));
  });
});

describe('renderWhoosh', () => {
  it('peaks near its marked peak', () => {
    const whoosh = renderWhoosh(8000);
    let loudest = 0;
    let at = 0;
    whoosh.left.forEach((value, index) => {
      if (Math.abs(value) > loudest) {
        loudest = Math.abs(value);
        at = index / 8000;
      }
    });
    expect(Math.abs(at - WHOOSH_PEAK_AT)).toBeLessThan(0.1);
  });
});

describe('encodeWav', () => {
  it('writes a 16-bit stereo PCM header and clamps samples', () => {
    const mix = createMix(0.01, 1000);
    mix.left[0] = 2;
    mix.right[0] = -2;
    const bytes = encodeWav(mix);
    const view = new DataView(bytes.buffer);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(1000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(10 * 4);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32767);
  });
});

describe('reel audio files', () => {
  it('renders the full-length bed and the whoosh as WAV', () => {
    const bed = reelBedWav();
    expect(new DataView(bed.buffer).getUint32(24, true)).toBe(SAMPLE_RATE);
    expect(bed.length).toBe(44 + 20 * SAMPLE_RATE * 4);
    expect(whooshWav().length).toBeGreaterThan(44);
  });
});
