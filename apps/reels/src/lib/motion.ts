import { Easing, interpolate, spring } from 'remotion';

const cubic = (t: number): number => t * t * t;

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export type EnterOptions = {
  delay?: number;
  damping?: number;
  durationInFrames?: number;
};

export function enter(frame: number, fps: number, options: EnterOptions = {}): number {
  const { delay = 0, damping = 200, durationInFrames } = options;
  return spring({
    frame: frame - delay,
    fps,
    config: { damping },
    ...(durationInFrames === undefined ? {} : { durationInFrames }),
  });
}

export function exit(frame: number, duration: number, length = 10): number {
  return interpolate(frame, [duration - length, duration], [0, 1], {
    ...CLAMP,
    easing: Easing.in(cubic),
  });
}

export function wipe(frame: number, length = 12): number {
  return interpolate(frame, [0, length], [1, 0], {
    ...CLAMP,
    easing: Easing.inOut(cubic),
  });
}

export function drift(frame: number, duration: number, from: number, to: number): number {
  return interpolate(frame, [0, duration], [from, to], CLAMP);
}

export function countUp(frame: number, target: number, start: number, length: number): number {
  const progress = interpolate(frame, [start, start + length], [0, 1], {
    ...CLAMP,
    easing: Easing.out(cubic),
  });
  return Math.round(target * progress);
}
