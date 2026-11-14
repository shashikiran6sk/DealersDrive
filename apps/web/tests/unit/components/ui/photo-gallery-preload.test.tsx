import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type GalleryPhoto, PhotoGallery } from '@/components/ui/photo-gallery';
import { VIEWER_SIZES } from '@/components/ui/photo-gallery/photo-gallery.constants';
import { preloadPhoto } from '@/components/ui/photo-gallery/preload-photo';
import { neighbourIndexes, saveDataRequested } from '@/components/ui/photo-gallery/utils';

/**
 * The next and previous photographs are fetched in the background once the one
 * on the stage has loaded, at the size the stage will ask for, so an arrow or a
 * swipe shows a photograph the browser already has (F034, step 3).
 */
const TITLE = '2021 Toyota Fortuner 2.8 4x2 AT';
const SIZES = '(min-width: 1024px) 690px, 100vw';

class FakeImage {
  static made: FakeImage[] = [];
  decoding = '';
  sizes = '';
  srcset = '';
  src = '';
  decode = vi.fn(() => Promise.resolve());
  constructor() {
    FakeImage.made.push(this);
  }
}

function photos(count: number): GalleryPhoto[] {
  return Array.from({ length: count }, (_, index) => ({
    url: `https://media.test/by-media/m${index}/1024.webp`,
    srcset: `https://media.test/by-media/m${index}/640.webp 640w, https://media.test/by-media/m${index}/1600.webp 1600w`,
    alt: `${TITLE}, photograph ${index + 1} of ${count}`,
  }));
}

function stageImage() {
  return within(screen.getByRole('button', { name: /^View (all|the photo)/ })).getByRole('img');
}

function preloaded(): string[] {
  return FakeImage.made.map((image) => image.src);
}

const url = (index: number) => `https://media.test/by-media/m${index}/1024.webp`;

beforeEach(() => {
  FakeImage.made = [];
  vi.stubGlobal('Image', FakeImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('preloading the neighbouring photographs', () => {
  it('waits for the stage photograph, so it never competes with it', () => {
    render(<PhotoGallery title={TITLE} photos={photos(5)} sizes={SIZES} />);

    expect(preloaded()).toEqual([]);
  });

  it('then fetches the next and the previous one, at the size the stage will ask for', () => {
    render(<PhotoGallery title={TITLE} photos={photos(5)} sizes={SIZES} />);
    fireEvent.load(stageImage());

    expect(preloaded()).toEqual([url(1), url(4)]);
    const [next] = FakeImage.made;
    expect(next).toMatchObject({ sizes: SIZES, srcset: photos(5)[1]?.srcset, decoding: 'async' });
    expect(next?.decode).toHaveBeenCalled();
  });

  it('moves with the stage, keeping what it already has and fetching only the new neighbour', async () => {
    const user = userEvent.setup();
    render(<PhotoGallery title={TITLE} photos={photos(5)} sizes={SIZES} />);
    fireEvent.load(stageImage());

    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(stageImage()).toHaveAttribute('src', url(1));
    expect(preloaded()).toEqual([url(1), url(4)]);

    fireEvent.load(stageImage());
    expect(preloaded()).toEqual([url(1), url(4), url(2), url(0)]);
  });

  it('treats a photograph that loaded before hydration as loaded', () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    const width = vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1024);
    try {
      render(<PhotoGallery title={TITLE} photos={photos(3)} sizes={SIZES} />);
      expect(preloaded()).toEqual([url(1), url(2)]);
    } finally {
      complete.mockRestore();
      width.mockRestore();
    }
  });

  it('fetches the one other photograph once, when there are two', () => {
    render(<PhotoGallery title={TITLE} photos={photos(2)} />);
    fireEvent.load(stageImage());

    expect(preloaded()).toEqual([url(1)]);
  });

  it('fetches nothing for a single photograph', () => {
    render(<PhotoGallery title={TITLE} photos={photos(1)} />);
    fireEvent.load(stageImage());

    expect(preloaded()).toEqual([]);
  });

  it('fetches nothing when the phone asks to save data', () => {
    vi.stubGlobal('navigator', { ...window.navigator, connection: { saveData: true } });
    render(<PhotoGallery title={TITLE} photos={photos(5)} />);
    fireEvent.load(stageImage());

    expect(preloaded()).toEqual([]);
  });

  it('preloads at the viewer size while the viewer is open', async () => {
    const user = userEvent.setup();
    render(<PhotoGallery title={TITLE} photos={photos(5)} sizes={SIZES} />);

    await user.click(screen.getByRole('button', { name: /^View all/ }));
    await screen.findByRole('dialog');
    await act(() => Promise.resolve());

    const viewer = FakeImage.made.filter((image) => image.sizes === VIEWER_SIZES);
    expect(viewer.map((image) => image.src)).toEqual([url(1), url(4)]);
  });
});

describe('preloadPhoto', () => {
  it('asks for a photograph without a srcset by its url alone', () => {
    const image = preloadPhoto({ url: url(0), alt: '' }, SIZES);
    expect(image).toMatchObject({ src: url(0), srcset: '', sizes: '' });
  });

  it('does not depend on decode() being there', () => {
    vi.stubGlobal(
      'Image',
      class {
        src = '';
      },
    );
    expect(() => preloadPhoto({ url: url(0), alt: '' }, SIZES)).not.toThrow();
  });

  it('swallows a photograph that fails to decode', async () => {
    const failing = vi.fn(() => Promise.reject(new Error('broken')));
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        decode = failing;
      },
    );
    preloadPhoto({ url: url(0), alt: '' }, SIZES);
    await expect(failing.mock.results[0]?.value).rejects.toThrow('broken');
  });
});

describe('neighbourIndexes', () => {
  it('names the next and the previous photograph, wrapping at either end', () => {
    expect(neighbourIndexes(0, 5)).toEqual([1, 4]);
    expect(neighbourIndexes(4, 5)).toEqual([0, 3]);
    expect(neighbourIndexes(2, 5)).toEqual([3, 1]);
  });

  it('names the other one once when there are two, and none for one or none', () => {
    expect(neighbourIndexes(0, 2)).toEqual([1]);
    expect(neighbourIndexes(0, 1)).toEqual([]);
    expect(neighbourIndexes(0, 0)).toEqual([]);
  });
});

describe('saveDataRequested', () => {
  it('is true only when the connection says so', () => {
    expect(saveDataRequested({ connection: { saveData: true } })).toBe(true);
    expect(saveDataRequested({ connection: { saveData: false } })).toBe(false);
    expect(saveDataRequested({ connection: null })).toBe(false);
    expect(saveDataRequested({})).toBe(false);
    expect(saveDataRequested(null)).toBe(false);
  });
});
