import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HeroBanner, heroImageFrom, HOME_HERO_IMAGE } from '@/features/home/hero-banner';

/**
 * The homepage hero: the copy on the left, and on the right either what the
 * page gives it (the stream of recent cars) or the photograph (**R81**). The
 * photograph is one value, `image`, so the admin setting supplies it without
 * touching the layout; with none, the frame draws its dark ground.
 */
describe('HeroBanner', () => {
  it('shows the photograph beside the copy when it is given nothing else', () => {
    render(
      <HeroBanner image={{ src: '/images/home-hero.jpg', alt: 'A dealer with customers' }}>
        <h1>Find your perfect car</h1>
      </HeroBanner>,
    );

    const photo = screen.getByRole('img', { name: 'A dealer with customers' });
    expect(photo).toHaveAttribute('src', '/images/home-hero.jpg');
    expect(screen.getByRole('heading', { level: 1, name: 'Find your perfect car' })).toBeVisible();
  });

  it('shows what it is given in place of the photograph', () => {
    render(
      <HeroBanner image={HOME_HERO_IMAGE} aside={<p>Cars listed now</p>}>
        <h1>Find your perfect car</h1>
      </HeroBanner>,
    );

    expect(screen.getByText('Cars listed now')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('draws a plain ground, and no broken image, when there is no photograph', () => {
    const { container } = render(
      <HeroBanner image={null}>
        <h1>Find your perfect car</h1>
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
