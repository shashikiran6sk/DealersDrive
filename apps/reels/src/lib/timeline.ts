import { REEL_DURATION, SCENE_FRAMES } from '../reel/reel.constants';

export type SceneName = 'opening' | 'services' | 'cars' | 'stock' | 'closing';

export type Slot = {
  from: number;
  duration: number;
};

export type SceneSlot = Slot & {
  name: SceneName;
};

export type Timeline = {
  scenes: SceneSlot[];
  cars: Slot[];
};

export type TimelineInput = {
  hasServices: boolean;
  carCount: number;
  total?: number;
};

export function splitFrames(total: number, parts: number): Slot[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  const slots: Slot[] = [];
  let from = 0;
  for (let index = 0; index < parts; index += 1) {
    const duration = index === parts - 1 ? total - from : base;
    slots.push({ from, duration });
    from += duration;
  }
  return slots;
}

export function cutFrames(timeline: Timeline): number[] {
  const cuts = new Set<number>();
  for (const scene of timeline.scenes) {
    if (scene.from > 0) cuts.add(scene.from);
  }
  const cars = timeline.scenes.find((scene) => scene.name === 'cars');
  if (cars !== undefined) {
    for (const slot of timeline.cars) {
      if (slot.from > 0) cuts.add(cars.from + slot.from);
    }
  }
  return [...cuts].sort((a, b) => a - b);
}

export function buildTimeline({
  hasServices,
  carCount,
  total = REEL_DURATION,
}: TimelineInput): Timeline {
  const services = hasServices ? SCENE_FRAMES.services : 0;
  const fixed = SCENE_FRAMES.opening + services + SCENE_FRAMES.stock + SCENE_FRAMES.closing;
  const remainder = Math.max(0, total - fixed);
  const cars = carCount > 0 ? remainder : 0;
  const stock = SCENE_FRAMES.stock + (carCount > 0 ? 0 : remainder);

  const plan: Array<[SceneName, number]> = [
    ['opening', SCENE_FRAMES.opening],
    ['services', services],
    ['cars', cars],
    ['stock', stock],
    ['closing', SCENE_FRAMES.closing],
  ];

  const scenes: SceneSlot[] = [];
  let from = 0;
  for (const [name, duration] of plan) {
    if (duration > 0) scenes.push({ name, from, duration });
    from += duration;
  }

  return { scenes, cars: splitFrames(cars, carCount) };
}
