import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HeroBanner, heroImageFrom, HOME_HERO_IMAGE } from '@/features/home/hero-banner';

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

  it('ships a committed photograph under the web app, described', () => {
    render(
      <HeroBanner image={HOME_HERO_IMAGE}>
        <p>copy</p>
      </HeroBanner>,
    );

    const photo = screen.getByRole('img');
    expect(photo).toHaveAttribute('src', '/images/home-hero.webp');
    expect(photo.getAttribute('alt')?.length).toBeGreaterThan(10);
  });
});

/**
 * Which photograph the homepage shows: the one an operator set in
 * `/admin/config` (already checked by the API), else the committed default.
 */
describe('heroImageFrom', () => {
  it('uses the committed photograph when nothing is configured', () => {
    expect(heroImageFrom(null)).toEqual(HOME_HERO_IMAGE);
    expect(heroImageFrom(undefined)).toEqual(HOME_HERO_IMAGE);
  });

  it('uses the configured photograph and its description', () => {
    expect(
      heroImageFrom({ src: 'https://media.example.org/diwali.webp', alt: 'Festive showroom' }),
    ).toEqual({ src: 'https://media.example.org/diwali.webp', alt: 'Festive showroom' });
  });

  it('keeps a description when the operator left it blank', () => {
    expect(heroImageFrom({ src: '/images/other.webp', alt: '  ' })).toEqual({
      src: '/images/other.webp',
      alt: HOME_HERO_IMAGE.alt,
    });
  });
});
