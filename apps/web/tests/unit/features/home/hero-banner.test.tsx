import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HeroBanner, HOME_HERO_IMAGE } from '@/features/home/hero-banner';

/**
 * The homepage's single hero banner (**R81**). The photograph is one value,
 * `image`, so that a later admin setting can supply it without touching the
 * layout; until a photograph is committed the banner draws its dark ground
 * and the copy still reads, white on black.
 */
describe('HeroBanner', () => {
  it('shows the photograph it is given, described', () => {
    render(
      <HeroBanner image={{ src: '/images/home-hero.jpg', alt: 'A dealer with customers' }}>
        <h1>Find your next car</h1>
      </HeroBanner>,
    );

    const photo = screen.getByRole('img', { name: 'A dealer with customers' });
    expect(photo).toHaveAttribute('src', '/images/home-hero.jpg');
    expect(screen.getByRole('heading', { level: 1, name: 'Find your next car' })).toBeVisible();
  });

  it('draws a plain ground, and no broken image, when there is no photograph', () => {
    const { container } = render(
      <HeroBanner image={null}>
        <h1>Find your next car</h1>
      </HeroBanner>,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  });

  it('renders the homepage with whatever the committed setting is', () => {
    render(
      <HeroBanner image={HOME_HERO_IMAGE}>
        <p>copy</p>
      </HeroBanner>,
    );

    expect(screen.getByText('copy')).toBeInTheDocument();
  });
});
