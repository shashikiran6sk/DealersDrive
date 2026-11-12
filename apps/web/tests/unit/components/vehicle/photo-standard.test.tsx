import { STANDARD_PHOTO_SLOTS } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  PhotoStandardGuide,
  PhotoWalkround,
  SHOT_GUIDES,
} from '@/components/vehicle/photo-standard';

describe('the photo standard', () => {
  it('covers exactly the ten standard slots, in walk-round order', () => {
    expect(SHOT_GUIDES.map((shot) => shot.slot)).toEqual(STANDARD_PHOTO_SLOTS);
    expect(SHOT_GUIDES.map((shot) => shot.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('illustrates where to stand and how to hold the phone for every shot', () => {
    render(<PhotoStandardGuide />);
    expect(screen.getAllByRole('img', { name: /^where to stand for the/i })).toHaveLength(10);
    expect(screen.getAllByRole('img', { name: /side view/i })).toHaveLength(10);
    expect(screen.getAllByText('Kneel on one knee').length).toBeGreaterThan(0);
  });

  it('marks the shots already taken on the walk-round', () => {
    const { container } = render(<PhotoWalkround done={[1, 2]} />);
    const done = [...container.querySelectorAll('circle')].filter(
      (circle) => circle.getAttribute('fill') === 'var(--color-ok)',
    );
    expect(done).toHaveLength(2);
  });
});
