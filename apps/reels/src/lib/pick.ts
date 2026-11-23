export function sampleAt(samples: ArrayLike<number>, index: number): number {
  return samples[index] ?? 0;
}

export function cyclic<T>(items: readonly T[], index: number, fallback: T): T {
  if (items.length === 0) return fallback;
  return items[((index % items.length) + items.length) % items.length] ?? fallback;
}
