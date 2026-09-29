import { createHash } from 'node:crypto';

export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function seedOf(text) {
  return Number.parseInt(createHash('sha1').update(String(text)).digest('hex').slice(0, 8), 16);
}

export function rngFor(text) {
  const random = mulberry32(seedOf(text));
  return {
    next: random,
    between: (low, high) => low + random() * (high - low),
    int: (low, high) => Math.floor(low + random() * (high - low + 1)),
    pick: (values) => values[Math.floor(random() * values.length)],
    chance: (p) => random() < p,
  };
}
