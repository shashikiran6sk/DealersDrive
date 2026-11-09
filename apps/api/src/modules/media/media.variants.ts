import sharp from 'sharp';

import { DERIVATIVE_WIDTHS } from '../../platform/media/urls.js';

export const VARIANT_WEBP_QUALITY = 78;

export interface RenderedVariant {
  requested: number;
  width: number;
  body: Buffer;
}

export interface RenderedImage {
  width: number;
  height: number;
  variants: RenderedVariant[];
}

export function isDerivativeWidth(width: number): boolean {
  return DERIVATIVE_WIDTHS.some((candidate) => candidate === width);
}

export function hasEveryVariant(variants: Record<string, string>): boolean {
  return DERIVATIVE_WIDTHS.every((width) => variants[String(width)] !== undefined);
}

export async function renderVariants(original: Buffer): Promise<RenderedImage> {
  const source = sharp(original, { autoOrient: true, failOn: 'error' });
  const { autoOrient } = await source.metadata();

  const bodies = new Map<number, Buffer>();
  const variants: RenderedVariant[] = [];
  for (const requested of DERIVATIVE_WIDTHS) {
    const width = Math.min(requested, autoOrient.width);
    let body = bodies.get(width);
    if (!body) {
      body = await source
        .clone()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: VARIANT_WEBP_QUALITY })
        .toBuffer();
      bodies.set(width, body);
    }
    variants.push({ requested, width, body });
  }

  return { width: autoOrient.width, height: autoOrient.height, variants };
}
