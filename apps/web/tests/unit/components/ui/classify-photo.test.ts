import { afterEach, describe, expect, it, vi } from 'vitest';

import { classifyPhoto } from '@/components/ui/photo-gallery/classify-photo';

const EDGE = 16;

function loadedImage(): HTMLImageElement {
  const image = document.createElement('img');
  vi.spyOn(image, 'complete', 'get').mockReturnValue(true);
  vi.spyOn(image, 'naturalWidth', 'get').mockReturnValue(1704);
  return image;
}

function fakeContext(pixel: readonly number[]) {
  const data = new Uint8ClampedArray(EDGE * EDGE * 4);
  for (let offset = 0; offset < data.length; offset += 4) data.set(pixel, offset);
  return {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data })),
  };
}

function canvasContext(context: unknown) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a test stand-in for the 2D context jsdom does not implement
  const value = context as CanvasRenderingContext2D;
  return vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(value);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('classifyPhoto', () => {
  it('calls a photograph on the StudioCar backdrop studio, sampled at 16 × 16', () => {
    const context = fakeContext([246, 246, 246, 255]);
    canvasContext(context);
    const image = loadedImage();

    expect(classifyPhoto(image)).toBe('studio');
    expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0, EDGE, EDGE);
    expect(context.getImageData).toHaveBeenCalledWith(0, 0, EDGE, EDGE);
  });

  it('calls any other photograph a photo', () => {
    canvasContext(fakeContext([90, 70, 60, 255]));

    expect(classifyPhoto(loadedImage())).toBe('photo');
  });

  it('cannot say when the pixels are unreadable, as a cross-origin image is', () => {
    const context = fakeContext([246, 246, 246, 255]);
    context.getImageData.mockImplementation(() => {
      throw new DOMException('The canvas has been tainted', 'SecurityError');
    });
    canvasContext(context);

    expect(classifyPhoto(loadedImage())).toBeNull();
  });

  it('cannot say without a 2D context, or before the photograph has loaded', () => {
    canvasContext(null);
    expect(classifyPhoto(loadedImage())).toBeNull();

    const loading = document.createElement('img');
    vi.spyOn(loading, 'complete', 'get').mockReturnValue(false);
    expect(classifyPhoto(loading)).toBeNull();
  });
});
