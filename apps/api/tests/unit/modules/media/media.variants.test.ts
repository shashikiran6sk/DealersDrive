import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  hasEveryVariant,
  isDerivativeWidth,
  renderVariants,
} from '../../../../src/modules/media/media.variants.js';

/**
 * F034 — the derivative renderer, driven with real image bytes. These are the
 * only tests that decode and encode an actual photograph.
 */

function photo(width: number, height: number, orientation?: number): Promise<Buffer> {
  const image = sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 40, b: 40 } },
  }).jpeg();
  return (orientation ? image.withMetadata({ orientation }) : image).toBuffer();
}

async function widthOf(body: Buffer): Promise<{ width: number; format: string }> {
  const meta = await sharp(body).metadata();
  return { width: meta.width, format: meta.format };
}

describe('renderVariants', () => {
  it('writes a WebP at each derivative width from a large photograph', async () => {
    const rendered = await renderVariants(await photo(4000, 3000));

    expect(rendered).toMatchObject({ width: 4000, height: 3000 });
    expect(rendered.variants.map((variant) => [variant.requested, variant.width])).toEqual([
      [320, 320],
      [640, 640],
      [1024, 1024],
      [1600, 1600],
    ]);
    for (const variant of rendered.variants) {
      expect(await widthOf(variant.body)).toEqual({ width: variant.width, format: 'webp' });
    }
  });

  it('never enlarges: widths above the original share one rendition at its own width', async () => {
    const rendered = await renderVariants(await photo(900, 600));

    expect(rendered.variants.map((variant) => [variant.requested, variant.width])).toEqual([
      [320, 320],
      [640, 640],
      [1024, 900],
      [1600, 900],
    ]);
    expect(rendered.variants[2]?.body).toBe(rendered.variants[3]?.body);
    expect(await widthOf(rendered.variants[3]?.body ?? Buffer.alloc(0))).toEqual({
      width: 900,
      format: 'webp',
    });
  });

  it('applies the EXIF orientation, so a portrait shot is measured upright', async () => {
    const rendered = await renderVariants(await photo(1200, 800, 6));

    expect(rendered).toMatchObject({ width: 800, height: 1200 });
    expect(rendered.variants.at(-1)?.width).toBe(800);
  });

  it('drops the metadata of the original', async () => {
    const rendered = await renderVariants(await photo(1200, 800, 6));
    const meta = await sharp(rendered.variants[0]?.body).metadata();

    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  it('rejects bytes that are not an image', async () => {
    await expect(
      renderVariants(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('a car')])),
    ).rejects.toThrow();
  });
});

describe('isDerivativeWidth', () => {
  it('knows the widths the processor writes', () => {
    expect([320, 640, 1024, 1600].every(isDerivativeWidth)).toBe(true);
    expect([1, 480, 800, 4000].some(isDerivativeWidth)).toBe(false);
  });
});

describe('hasEveryVariant', () => {
  it('is true only when every derivative width has a key', () => {
    expect(hasEveryVariant({ '320': 'a', '640': 'b', '1024': 'c', '1600': 'd' })).toBe(true);
    expect(hasEveryVariant({ '320': 'a', '640': 'b', '1024': 'c' })).toBe(false);
    expect(hasEveryVariant({})).toBe(false);
  });
});
