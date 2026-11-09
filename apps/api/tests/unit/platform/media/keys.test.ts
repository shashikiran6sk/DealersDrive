import { describe, expect, it } from 'vitest';

import { mediaObjectKeys, variantMap } from '../../../../src/platform/media/keys.js';

describe('variantMap', () => {
  it('keeps only non-empty string keys', () => {
    expect(variantMap({ '640': 'a.webp', '1024': '', '1600': 3 })).toEqual({ '640': 'a.webp' });
  });

  it.each([null, undefined, 'x', ['a.webp']])('reads %j as no variants', (value) => {
    expect(variantMap(value)).toEqual({});
  });
});

describe('mediaObjectKeys', () => {
  it('lists the original and every distinct derivative once', () => {
    expect(
      mediaObjectKeys({
        storageKey: 'o.jpg',
        variants: { '320': 'o-320.webp', '1024': 'o-900.webp', '1600': 'o-900.webp' },
      }),
    ).toEqual(['o.jpg', 'o-320.webp', 'o-900.webp']);
  });

  it('is the original alone when nothing was rendered', () => {
    expect(mediaObjectKeys({ storageKey: 'o.jpg', variants: {} })).toEqual(['o.jpg']);
  });
});
