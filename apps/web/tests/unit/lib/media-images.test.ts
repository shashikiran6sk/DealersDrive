import { describe, expect, it } from 'vitest';

import { imageAtWidth, responsiveImage } from '../../../src/lib/media-images.js';

describe('responsive media URLs', () => {
  it('offers exact-width candidates for stable API media URLs', () => {
    const url = 'https://media.dealers-drive.com/media/by-media/photo/640.webp';
    expect(imageAtWidth(url, 320)).toBe(url.replace('640', '320'));
    expect(responsiveImage(url)).toBe(
      [320, 640, 1024, 1600]
        .map((width) => `${url.replace('640', String(width))} ${String(width)}w`)
        .join(', '),
    );
  });
  it('does not rewrite external images or signed original URLs', () => {
    for (const url of [
      'https://other.example/photo.jpg',
      'https://bucket.example/original.jpg?token=secret',
    ]) {
      expect(imageAtWidth(url, 320)).toBe(url);
      expect(responsiveImage(url)).toBeUndefined();
    }
  });
});
