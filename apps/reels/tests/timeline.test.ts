import { describe, expect, it } from 'vitest';

import { buildTimeline, cutFrames, splitFrames } from '../src/lib/timeline';
import { REEL_DURATION, SCENE_FRAMES } from '../src/reel/reel.constants';

function total(slots: Array<{ duration: number }>): number {
  return slots.reduce((sum, slot) => sum + slot.duration, 0);
}

describe('splitFrames', () => {
  it('divides evenly and hands the remainder to the last slot', () => {
    expect(splitFrames(301, 4)).toEqual([
      { from: 0, duration: 75 },
      { from: 75, duration: 75 },
      { from: 150, duration: 75 },
      { from: 225, duration: 76 },
    ]);
  });

  it('returns nothing for no parts', () => {
    expect(splitFrames(300, 0)).toEqual([]);
  });
});

describe('buildTimeline', () => {
  it('fills exactly twenty seconds with every scene in order', () => {
    const timeline = buildTimeline({ hasServices: true, carCount: 4 });
    expect(timeline.scenes.map((scene) => scene.name)).toEqual([
      'opening',
      'services',
      'cars',
      'stock',
      'closing',
    ]);
    expect(total(timeline.scenes)).toBe(REEL_DURATION);
    expect(timeline.cars).toHaveLength(4);
    expect(total(timeline.cars)).toBe(timeline.scenes[2]?.duration);
  });

  it('gives the services frames to the cars when a dealer lists no services', () => {
    const timeline = buildTimeline({ hasServices: false, carCount: 2 });
    expect(timeline.scenes.map((scene) => scene.name)).not.toContain('services');
    expect(total(timeline.scenes)).toBe(REEL_DURATION);
    expect(timeline.cars[0]?.duration).toBeGreaterThan(SCENE_FRAMES.services);
  });

  it('starts each scene where the previous one ended', () => {
    const { scenes } = buildTimeline({ hasServices: true, carCount: 3 });
    scenes.forEach((scene, index) => {
      const previous = scenes[index - 1];
      expect(scene.from).toBe(previous === undefined ? 0 : previous.from + previous.duration);
    });
  });

  it('gives the car frames to the stock scene when there are no cars to feature', () => {
    const timeline = buildTimeline({ hasServices: true, carCount: 0 });
    expect(timeline.cars).toEqual([]);
    expect(timeline.scenes.find((scene) => scene.name === 'stock')?.duration).toBeGreaterThan(
      SCENE_FRAMES.stock,
    );
    expect(total(timeline.scenes)).toBe(REEL_DURATION);
  });
});

describe('cutFrames', () => {
  it('lists every scene change and every car change once, in order', () => {
    const timeline = buildTimeline({ hasServices: true, carCount: 8 });
    const cuts = cutFrames(timeline);
    expect(cuts).toEqual([...new Set(cuts)].sort((a, b) => a - b));
    expect(cuts).not.toContain(0);
    expect(cuts).toHaveLength(4 + 7);
    expect(cuts).toContain(SCENE_FRAMES.opening);
  });

  it('copes with a reel that has no cars', () => {
    expect(cutFrames(buildTimeline({ hasServices: false, carCount: 0 }))).toHaveLength(2);
  });
});

describe('the beat grid', () => {
  it('cuts every scene and car on a beat of the 120 BPM bed', () => {
    const framesPerBeat = 15;
    for (const cut of cutFrames(buildTimeline({ hasServices: true, carCount: 8 }))) {
      expect(cut % framesPerBeat).toBe(0);
    }
  });
});
