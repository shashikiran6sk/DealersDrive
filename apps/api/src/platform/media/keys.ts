import { isRecord } from '../errors.js';

export interface MediaObjects {
  storageKey: string;
  variants: unknown;
}

export function variantMap(variants: unknown): Record<string, string> {
  if (!isRecord(variants) || Array.isArray(variants)) return {};
  const map: Record<string, string> = {};
  for (const [width, key] of Object.entries(variants)) {
    if (typeof key === 'string' && key.length > 0) map[width] = key;
  }
  return map;
}

export function mediaObjectKeys(media: MediaObjects): string[] {
  return [...new Set([media.storageKey, ...Object.values(variantMap(media.variants))])];
}

export function variantKey(storageKey: string, width: number): string {
  return `${storageKey.replace(/\.[a-z0-9]+$/i, '')}-${String(width)}.webp`;
}
