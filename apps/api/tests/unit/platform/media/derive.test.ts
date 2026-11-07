import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  DERIVATIVE_TYPE,
  derivativeKey,
  deriveImages,
} from '../../../../src/platform/media/derive.js';
import { DERIVATIVE_WIDTHS } from '../../../../src/platform/media/urls.js';

/**
 * Unit tests for `src/platform/media/derive.ts` (**F034**).
 *
 * These drive real image bytes through sharp: the point of the module is that a
 * phone asking for the 320 thumbnail gets 320 pixels, not the camera original.
 */
const KEY = 'vehicles/vehicle-1/media-1/original.jpg';

function photo(width: number, height: number, orientation?: number): Promise<Buffer> {
  const image = sharp({ create: { width, height, channels: 3, background: '#7a1f2b' } });
  return (orientation ? image.withMetadata({ orientation }) : image).jpeg().toBuffer();
}

describe('derivativeKey', () => {
  it('puts a width beside the original, whatever the original was called', () => {
    expect(derivativeKey(KEY, 640)).toBe('vehicles/vehicle-1/media-1/640.webp');
    expect(derivativeKey('vehicles/v/m/original.webp', 320)).toBe('vehicles/v/m/320.webp');
  });
});

describe('deriveImages', () => {
  it('writes one WebP per width, each at that width', async () => {
    const derived = await deriveImages(KEY, await photo(2400, 1800));

    expect(derived).toMatchObject({ width: 2400, height: 1800 });
    expect(derived.derivatives.map((derivative) => derivative.width)).toEqual([
      ...DERIVATIVE_WIDTHS,
    ]);
    for (const derivative of derived.derivatives) {
      const meta = await sharp(derivative.body).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(derivative.width);
      expect(meta.height).toBe((derivative.width * 3) / 4);
      expect(derivative.key).toBe(derivativeKey(KEY, derivative.width));
    }
    expect(DERIVATIVE_TYPE).toBe('image/webp');
  });

  it('never enlarges a photograph smaller than a width', async () => {
    const derived = await deriveImages(KEY, await photo(800, 600));
    const widths = await Promise.all(
      derived.derivatives.map(
        async (derivative) => (await sharp(derivative.body).metadata()).width,
      ),
    );
    expect(widths).toEqual([320, 640, 800, 800]);
  });

  it('turns a portrait the camera stored sideways upright, and keeps no metadata', async () => {
    const derived = await deriveImages(KEY, await photo(1200, 900, 6), [320]);
    expect(derived).toMatchObject({ width: 900, height: 1200 });

    const [thumb] = derived.derivatives;
    const meta = await sharp(thumb?.body).metadata();
    expect(meta).toMatchObject({ width: 320, height: 427 });
    expect(meta.orientation).toBeUndefined();
    expect(meta.exif).toBeUndefined();
  });

  it('is far smaller than the original it came from', async () => {
    const original = await sharp({
      create: {
        width: 4000,
        height: 3000,
        channels: 3,
        background: '#808080',
        noise: { type: 'gaussian', mean: 128, sigma: 40 },
      },
    })
      .jpeg({ quality: 92 })
      .toBuffer();
    const [thumb] = (await deriveImages(KEY, original, [320])).derivatives;
    expect(thumb?.body.length).toBeLessThan(original.length / 20);
  });

  it('keeps the StudioCar backdrop at exactly #F6F6F6, so the car page can still whiten it', async () => {
    const studio = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: '#f6f6f6' },
    })
      .webp({ quality: 90 })
      .toBuffer();
    for (const derivative of (await deriveImages(KEY, studio)).derivatives) {
      const { data } = await sharp(derivative.body)
        .extract({ left: 0, top: 0, width: 1, height: 1 })
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect([...data.subarray(0, 3)]).toEqual([246, 246, 246]);
    }
  });

  it('rejects bytes that are not an image', async () => {
    await expect(deriveImages(KEY, Buffer.from('not a photograph'))).rejects.toThrow();
  });
});
