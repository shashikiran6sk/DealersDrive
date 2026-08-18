import { describe, expect, it } from 'vitest';

import { env } from '../../../../src/config/env.js';
import { DERIVATIVE_WIDTHS, mediaUrl, srcsetFor } from '../../../../src/platform/media/urls.js';

/**
 * Unit tests for `src/platform/media/urls.ts`.
 *
 * The point of this module is that media is addressed by **id and width**, never
 * by storage key — so the bucket layout can change without invalidating a single
 * cached page. That property is what these tests pin.
 */
describe('mediaUrl', () => {
  const mediaId = '0f2ff36b-efd7-4018-afe5-ccd3d2dc4fa9';

  it('addresses an image by id and width, never by storage key', () => {
    expect(mediaUrl(mediaId, 640)).toBe(
      `${env.MEDIA_BASE_URL}/vehicles/by-media/${mediaId}/640.webp`,
    );
  });

  it('is built from MEDIA_BASE_URL, so the CDN can move without a code change', () => {
    expect(mediaUrl(mediaId, 320).startsWith(env.MEDIA_BASE_URL)).toBe(true);
  });

  it('always names a .webp rendition', () => {
    for (const width of DERIVATIVE_WIDTHS) {
      expect(mediaUrl(mediaId, width).endsWith(`/${width}.webp`)).toBe(true);
    }
  });
});

describe('DERIVATIVE_WIDTHS', () => {
  it('is the set the processor writes, ascending', () => {
    expect([...DERIVATIVE_WIDTHS]).toEqual([320, 640, 1024, 1600]);
    expect([...DERIVATIVE_WIDTHS]).toEqual([...DERIVATIVE_WIDTHS].sort((a, b) => a - b));
  });
});

describe('srcsetFor', () => {
  const mediaId = 'a1b2c3d4-0000-4000-8000-000000000000';

  it('names every width the processor actually wrote', () => {
    const srcset = srcsetFor(mediaId);

    for (const width of DERIVATIVE_WIDTHS) {
      // A srcset that promises a width nobody generated is a 404 in the browser
      // for whichever device picks it.
      expect(srcset).toContain(`${mediaUrl(mediaId, width)} ${width}w`);
    }
  });

  it('is a comma-separated list in the order the widths are declared', () => {
    const entries = srcsetFor(mediaId).split(', ');

    expect(entries).toHaveLength(DERIVATIVE_WIDTHS.length);
    expect(entries.map((entry) => entry.split(' ')[1])).toEqual(
      DERIVATIVE_WIDTHS.map((width) => `${width}w`),
    );
  });
});
