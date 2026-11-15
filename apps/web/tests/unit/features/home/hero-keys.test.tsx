import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HERO_KEYS_IMAGE, HeroKeys } from '@/features/home/hero-keys';

describe('HeroKeys', () => {
  it('draws the committed key photograph at its intrinsic size', () => {
    const { container } = render(<HeroKeys />);

    const photo = container.querySelector('img');
    expect(photo).toHaveAttribute('src', '/images/home-keys.webp');
    expect(photo).toHaveAttribute('width', String(HERO_KEYS_IMAGE.width));
    expect(photo).toHaveAttribute('height', String(HERO_KEYS_IMAGE.height));
  });

  it('is decoration, hidden from assistive technology', () => {
    render(<HeroKeys />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
