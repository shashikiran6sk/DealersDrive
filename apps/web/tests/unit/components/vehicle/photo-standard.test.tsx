import { STANDARD_PHOTO_SLOTS } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  PHOTO_GUIDE_ASSETS,
  PhotoStandardGuide,
  SHOT_GUIDES,
  shotImage,
} from '@/components/vehicle/photo-standard';

describe('the confirmed photo guide', () => {
  it('covers exactly the ten slots, in shooting order', () => {
    expect(SHOT_GUIDES.map((shot) => shot.slot)).toEqual(STANDARD_PHOTO_SLOTS);
    expect(SHOT_GUIDES.map((shot) => shot.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(SHOT_GUIDES.every((shot) => shot.steps.length === 4 && shot.checks.length === 3)).toBe(
      true,
    );
  });

  it('shows where to stand, the result and the plan for every photo, from the guide’s own pictures', () => {
    render(<PhotoStandardGuide />);
    expect(screen.getAllByRole('img', { name: /^a dealer in position/i })).toHaveLength(10);
    expect(screen.getAllByRole('img', { name: /seen from above$/i })).toHaveLength(10);
    expect(
      screen.getByRole('img', { name: /^a dealer in position to take the odometer/i }),
    ).toHaveAttribute('src', shotImage(10, 'position'));
  });

  it('teaches the four poses and offers the PDF', () => {
    render(<PhotoStandardGuide />);
    expect(screen.getAllByText('Kneel at the door').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Download the guide (PDF)' })).toHaveAttribute(
      'href',
      PHOTO_GUIDE_ASSETS.pdf,
    );
  });
});
