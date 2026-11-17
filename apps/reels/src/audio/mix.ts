import { sampleAt } from '../lib/pick';

export type Mix = {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
};

export function createMix(seconds: number, sampleRate: number): Mix {
  const length = Math.round(seconds * sampleRate);
  return { left: new Float32Array(length), right: new Float32Array(length), sampleRate };
}

export function panGains(pan: number): [number, number] {
  const angle = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
}

export type StereoSample = [number, number];

export function addVoice(
  mix: Mix,
  at: number,
  seconds: number,
  render: (t: number) => number | StereoSample,
  pan = 0,
): void {
  const start = Math.round(at * mix.sampleRate);
  const length = Math.round(seconds * mix.sampleRate);
  const [gainLeft, gainRight] = panGains(pan);
  for (let index = 0; index < length; index += 1) {
    const position = start + index;
    if (position < 0) continue;
    if (position >= mix.left.length) break;
    const value = render(index / mix.sampleRate);
    if (typeof value === 'number') {
      mix.left[position] = sampleAt(mix.left, position) + value * gainLeft;
      mix.right[position] = sampleAt(mix.right, position) + value * gainRight;
    } else {
      mix.left[position] = sampleAt(mix.left, position) + value[0];
      mix.right[position] = sampleAt(mix.right, position) + value[1];
    }
  }
}

export function peak(mix: Mix): number {
  const loudest = (samples: Float32Array) =>
    samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  return Math.max(loudest(mix.left), loudest(mix.right));
}

export function normalize(mix: Mix, target: number): Mix {
  const loudest = peak(mix);
  if (loudest === 0) return mix;
  const gain = target / loudest;
  mix.left.set(mix.left.map((value) => value * gain));
  mix.right.set(mix.right.map((value) => value * gain));
  return mix;
}

export function softClip(mix: Mix, drive: number): Mix {
  const shape = (value: number) => Math.tanh(value * drive);
  mix.left.set(mix.left.map(shape));
  mix.right.set(mix.right.map(shape));
  return mix;
}
