import { Svf } from './filter';
import { addVoice, createMix, normalize, type Mix, type StereoSample } from './mix';
import { noiseSource } from './prng';

export const WHOOSH_SECONDS = 0.5;
export const WHOOSH_PEAK_AT = 0.3;

export function renderWhoosh(sampleRate: number, seed = 7): Mix {
  const mix = createMix(WHOOSH_SECONDS, sampleRate);
  const noise = noiseSource(seed);
  const left = new Svf(sampleRate);
  const right = new Svf(sampleRate);
  addVoice(mix, 0, WHOOSH_SECONDS, (t): StereoSample => {
    const progress = t / WHOOSH_SECONDS;
    const rising = t < WHOOSH_PEAK_AT;
    const envelope = rising ? (t / WHOOSH_PEAK_AT) ** 2 : Math.exp(-(t - WHOOSH_PEAK_AT) / 0.06);
    const cutoff = 450 * 10 ** Math.sin(Math.PI * Math.min(1, progress * 0.9));
    left.process(noise(), cutoff, 1.6);
    right.process(noise(), cutoff * 1.08, 1.6);
    const pan = -0.7 + 1.4 * progress;
    return [left.band * envelope * (1 - pan) * 0.5, right.band * envelope * (1 + pan) * 0.5];
  });
  return normalize(mix, 0.8);
}
