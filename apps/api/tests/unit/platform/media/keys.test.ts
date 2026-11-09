import { describe, expect, it } from 'vitest';

import { mediaObjectKeys, variantKey, variantMap } from '../../../../src/platform/media/keys.js';

describe('variantKey', () => {
  it('puts a vehicle derivative beside its original, named for its width', () => {
    expect(variantKey('vehicles/v-1/m-1/original.jpg', 640)).toBe(
      'vehicles/v-1/m-1/original-640.webp',
    );
  });

  it('appends to a key that has no extension, such as a portfolio photograph', () => {
    expect(variantKey('dealers/a.b-motors/portfolio/m-1', 320)).toBe(
      'dealers/a.b-motors/portfolio/m-1-320.webp',
    );
  });
});

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
