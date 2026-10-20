import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type GalleryPhoto, PhotoGallery } from '@/components/ui/photo-gallery';
import { classifyPhoto } from '@/components/ui/photo-gallery/classify-photo';
import {
  cornerKind,
  isStudioBackdrop,
  studioFilterId,
  studioWhiteLevel,
  studioWhiteTable,
} from '@/components/ui/photo-gallery/utils';

vi.mock('@/components/ui/photo-gallery/classify-photo', () => ({
  classifyPhoto: vi.fn(() => null),
}));

const TITLE = '2019 Ford Endeavour Titanium 3.2 4x4 AT';
const classify = vi.mocked(classifyPhoto);

function images(count: number): GalleryPhoto[] {
  return Array.from({ length: count }, (_, index) => ({
    url: `https://media.test/by-media/m${index}/1600.webp`,
    alt: `${TITLE}, photograph ${index + 1} of ${count}`,
  }));
}

function stage() {
  return within(screen.getByRole('region', { name: 'Photographs' })).getByRole('button', {
    name: new RegExp(`of ${TITLE}$`),
  });
}

function stageImage() {
  return within(stage()).getByRole('img');
}

function filterElement() {
  return document.querySelector('filter');
}

afterEach(() => {
  classify.mockReset();
  classify.mockReturnValue(null);
});

describe('the studio variant', () => {
  it('draws the stage on the page colour with no border, and contains the photograph', () => {
    render(<PhotoGallery title={TITLE} photos={images(2)} variant="studio" />);

    expect(stage()).toHaveClass('blueprint', 'border-0', 'bg-(--color-page)');
    expect(stage()).not.toHaveClass('bg-(--color-surface)');
    expect(stageImage()).toHaveClass('object-contain');
    expect(stageImage()).not.toHaveClass('object-cover');
  });

  it('whitens the photograph through one sRGB lookup filter until it is known not to be StudioCar', () => {
    render(<PhotoGallery title={TITLE} photos={images(2)} variant="studio" />);

    const filter = filterElement();
    expect(filter).not.toBeNull();
    expect(filter?.getAttribute('color-interpolation-filters')).toBe('sRGB');
    expect(filter?.querySelectorAll('feFuncR, feFuncG, feFuncB')).toHaveLength(3);
    expect(stageImage().style.filter).toBe(`url("#${filter?.id ?? ''}")`);
    expect(filter?.closest('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps the filter on a StudioCar photograph and on one it could not read', () => {
    render(<PhotoGallery title={TITLE} photos={images(2)} variant="studio" />);

    classify.mockReturnValueOnce('studio');
    fireEvent.load(stageImage());
    expect(stageImage().style.filter).not.toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    classify.mockReturnValueOnce(null);
    fireEvent.load(stageImage());
    expect(stageImage().style.filter).not.toBe('');
  });

  it('shows any other photograph exactly as stored, and remembers it by URL', () => {
    render(<PhotoGallery title={TITLE} photos={images(2)} variant="studio" />);

    classify.mockReturnValueOnce('photo');
    fireEvent.load(stageImage());
    expect(stageImage().style.filter).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    expect(stageImage().style.filter).not.toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
    expect(stageImage().style.filter).toBe('');
  });

  it('classifies a photograph that had already loaded before the page hydrated', () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    const width = vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1704);
    classify.mockReturnValue('photo');
    try {
      render(<PhotoGallery title={TITLE} photos={images(1)} variant="studio" />);

      expect(stageImage().style.filter).toBe('');
    } finally {
      complete.mockRestore();
      width.mockRestore();
    }
  });
});

describe('the default variant', () => {
  it('is unchanged: a surface stage, a covering photograph, and no filter', () => {
    render(<PhotoGallery title={TITLE} photos={images(2)} />);

    expect(stage()).toHaveClass('blueprint', 'bg-(--color-surface)');
    expect(stage()).not.toHaveClass('border-0');
    expect(stageImage()).toHaveClass('object-cover');
    expect(stageImage().style.filter).toBe('');
    expect(filterElement()).toBeNull();
  });

  it('never reads a photograph', () => {
    render(<PhotoGallery title={TITLE} photos={images(2)} />);

    fireEvent.load(stageImage());

    expect(classify).not.toHaveBeenCalled();
  });
});

describe('the studio white helpers', () => {
  it('leaves every level up to the knee alone, lifts the band above it, and whitens the backdrop', () => {
    expect(studioWhiteLevel(0)).toBe(0);
    expect(studioWhiteLevel(128)).toBe(128);
    expect(studioWhiteLevel(216)).toBe(216);
    expect(studioWhiteLevel(231)).toBeCloseTo(235.5, 5);
    expect(studioWhiteLevel(245)).toBeGreaterThan(253);
    expect(studioWhiteLevel(246)).toBe(255);
    expect(studioWhiteLevel(255)).toBe(255);
  });

  it('never makes a level darker, and never reverses two levels', () => {
    let previous = -1;
    for (let level = 0; level <= 255; level += 1) {
      const mapped = studioWhiteLevel(level);
      expect(mapped).toBeGreaterThanOrEqual(level);
      expect(mapped).toBeGreaterThanOrEqual(previous);
      previous = mapped;
    }
  });

  it('writes the lookup table as 86 fractions, ending on white at 246 and above', () => {
    const values = studioWhiteTable().split(' ').map(Number);

    expect(values).toHaveLength(86);
    expect(values[0]).toBe(0);
    expect(values[72]).toBeCloseTo(216 / 255, 4);
    expect(values.slice(82)).toEqual([1, 1, 1, 1]);
  });

  it('recognises the StudioCar backdrop within its tolerance, and nothing else', () => {
    expect(isStudioBackdrop([246, 246, 246, 255])).toBe(true);
    expect(isStudioBackdrop([243, 249, 245, 255, 246, 246, 246, 255])).toBe(true);
    expect(isStudioBackdrop([255, 255, 255, 255])).toBe(false);
    expect(isStudioBackdrop([246, 246, 240, 255])).toBe(false);
    expect(isStudioBackdrop([])).toBe(false);
  });

  it('calls a sample StudioCar only when all four corners are the backdrop', () => {
    const edge = 4;
    const backdrop = Array.from({ length: edge * edge }, () => [246, 246, 246, 255]).flat();
    expect(cornerKind(backdrop, edge)).toBe('studio');

    const centreDark = [...backdrop];
    centreDark.splice(5 * 4, 4, 20, 20, 20, 255);
    expect(cornerKind(centreDark, edge)).toBe('studio');

    const cornerDark = [...backdrop];
    cornerDark.splice((edge * edge - 1) * 4, 4, 20, 20, 20, 255);
    expect(cornerKind(cornerDark, edge)).toBe('photo');

    expect(cornerKind([], edge)).toBe('photo');
  });

  it('turns a React id into one a url(#…) reference can name', () => {
    expect(studioFilterId('«r1»')).toBe('dd-studio-white-r1');
    expect(studioFilterId(':R_1bi:')).toBe('dd-studio-white-R_1bi');
  });
});
