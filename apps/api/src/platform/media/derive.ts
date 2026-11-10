import { posix } from 'node:path';

import sharp from 'sharp';

import { DERIVATIVE_WIDTHS } from './urls.js';

export const DERIVATIVE_TYPE = 'image/webp';
export const DERIVATIVE_QUALITY = 80;

export interface Derivative {
  width: number;
  key: string;
  body: Buffer;
}

export interface DerivedImage {
  width: number;
  height: number;
  derivatives: Derivative[];
}

export function derivativeKey(storageKey: string, width: number): string {
  return posix.join(posix.dirname(storageKey), `${String(width)}.webp`);
}

export async function deriveImages(
  storageKey: string,
  body: Buffer,
  widths: readonly number[] = DERIVATIVE_WIDTHS,
): Promise<DerivedImage> {
  const { autoOrient } = await sharp(body).metadata();
  const derivatives: Derivative[] = [];
  for (const width of widths) {
    const output = await sharp(body)
      .autoOrient()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: DERIVATIVE_QUALITY })
      .toBuffer();
    derivatives.push({ width, key: derivativeKey(storageKey, width), body: output });
  }
  return { width: autoOrient.width, height: autoOrient.height, derivatives };
}
