import { sampleAt } from '../lib/pick';

import { Svf } from './filter';
import { addVoice, type Mix, type StereoSample } from './mix';

export function midiToHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

export function kick(mix: Mix, at: number, gain: number, noise: () => number): void {
  let phase = 0;
  addVoice(mix, at, 0.45, (t) => {
    const frequency = 46 + 110 * Math.exp(-t / 0.032);
    phase += frequency / mix.sampleRate;
    const body = Math.sin(2 * Math.PI * phase) * Math.exp(-t / 0.26);
    const click = t < 0.003 ? noise() * 0.35 : 0;
    return (body + click) * gain;
  });
}

export function clap(mix: Mix, at: number, gain: number, noise: () => number): void {
  const filter = new Svf(mix.sampleRate);
  const bursts = [0, 0.011, 0.022];
  addVoice(mix, at, 0.32, (t) => {
    filter.process(noise(), 1300, 1.1);
    const flutter = bursts.reduce(
      (sum, start) => (t >= start ? sum + Math.exp(-(t - start) / 0.007) : sum),
      0,
    );
    const tail = t >= 0.022 ? Math.exp(-(t - 0.022) / 0.11) * 0.75 : 0;
    return filter.band * (flutter * 0.5 + tail) * gain;
  });
}

export function hat(
  mix: Mix,
  at: number,
  gain: number,
  decay: number,
  pan: number,
  noise: () => number,
): void {
  const filter = new Svf(mix.sampleRate);
  addVoice(
    mix,
    at,
    decay * 6,
    (t) => {
      filter.process(noise(), 7600, 0.8);
      return filter.high * Math.exp(-t / decay) * gain;
    },
    pan,
  );
}

export function crash(mix: Mix, at: number, gain: number, noise: () => number): void {
  const left = new Svf(mix.sampleRate);
  const right = new Svf(mix.sampleRate);
  addVoice(mix, at, 2.6, (t): StereoSample => {
    left.process(noise(), 4800, 0.7);
    right.process(noise(), 5200, 0.7);
    const envelope = Math.exp(-t / 0.8) * gain;
    return [left.high * envelope, right.high * envelope];
  });
}

export function riser(
  mix: Mix,
  at: number,
  seconds: number,
  gain: number,
  noise: () => number,
): void {
  const filter = new Svf(mix.sampleRate);
  addVoice(mix, at, seconds, (t) => {
    const progress = t / seconds;
    filter.process(noise(), 250 * 24 ** progress, 2.2);
    return filter.band * progress ** 2.2 * gain;
  });
}

export function boom(mix: Mix, at: number, gain: number): void {
  let phase = 0;
  addVoice(mix, at, 2.2, (t) => {
    phase += (38 + 40 * Math.exp(-t / 0.08)) / mix.sampleRate;
    return Math.sin(2 * Math.PI * phase) * Math.exp(-t / 0.7) * gain;
  });
}

export function bass(mix: Mix, at: number, seconds: number, note: number, gain: number): void {
  const filter = new Svf(mix.sampleRate);
  const frequency = midiToHz(note);
  let phase = 0;
  addVoice(mix, at, seconds + 0.03, (t) => {
    phase = (phase + frequency / mix.sampleRate) % 1;
    const saw = 2 * phase - 1;
    const sub = Math.sin(2 * Math.PI * phase);
    filter.process(saw, 280 + 900 * Math.exp(-t / 0.06), 0.9);
    const attack = Math.min(1, t / 0.004);
    const release = t > seconds ? Math.max(0, 1 - (t - seconds) / 0.03) : 1;
    return (filter.low * 0.7 + sub * 0.6) * attack * release * gain;
  });
}

export function pad(
  mix: Mix,
  at: number,
  seconds: number,
  notes: readonly number[],
  gain: number,
  cutoff: (t: number) => number,
): void {
  const left = new Svf(mix.sampleRate);
  const right = new Svf(mix.sampleRate);
  const detune = 2 ** (7 / 1200);
  const frequencies = notes.map(midiToHz);
  const phaseLeft = new Float64Array(notes.length);
  const phaseRight = new Float64Array(notes.length);
  const release = 0.4;
  addVoice(mix, at, seconds + release, (t): StereoSample => {
    let sumLeft = 0;
    let sumRight = 0;
    frequencies.forEach((frequency, index) => {
      const nextLeft = (sampleAt(phaseLeft, index) + frequency / detune / mix.sampleRate) % 1;
      const nextRight = (sampleAt(phaseRight, index) + (frequency * detune) / mix.sampleRate) % 1;
      phaseLeft[index] = nextLeft;
      phaseRight[index] = nextRight;
      sumLeft += 2 * nextLeft - 1;
      sumRight += 2 * nextRight - 1;
    });
    const cut = cutoff(at + t);
    left.process(sumLeft, cut, 0.7);
    right.process(sumRight, cut, 0.7);
    const attack = Math.min(1, t / 0.18);
    const fade = t > seconds ? Math.max(0, 1 - (t - seconds) / release) : 1;
    const envelope = attack * fade * gain;
    return [left.low * envelope, right.low * envelope];
  });
}

export function pluck(mix: Mix, at: number, note: number, gain: number, pan: number): void {
  const frequency = midiToHz(note);
  let phase = 0;
  addVoice(
    mix,
    at,
    0.5,
    (t) => {
      phase = (phase + frequency / mix.sampleRate) % 1;
      const triangle = 4 * Math.abs(phase - 0.5) - 1;
      const sine = Math.sin(4 * Math.PI * phase) * 0.25;
      return (triangle + sine) * Math.min(1, t / 0.002) * Math.exp(-t / 0.11) * gain;
    },
    pan,
  );
}

export function duck(mix: Mix, hits: readonly number[], depth: number, recover: number): Mix {
  const sorted = [...hits].sort((a, b) => a - b);
  let next = 0;
  let last = -Infinity;
  for (let index = 0; index < mix.left.length; index += 1) {
    const t = index / mix.sampleRate;
    let hit = sorted[next];
    while (hit !== undefined && hit <= t) {
      last = hit;
      next += 1;
      hit = sorted[next];
    }
    const gain = 1 - depth * Math.exp(-(t - last) / recover);
    mix.left[index] = sampleAt(mix.left, index) * gain;
    mix.right[index] = sampleAt(mix.right, index) * gain;
  }
  return mix;
}
