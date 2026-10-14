import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import manifest from '@/app/manifest';
import { BrandLockup, BrandLogo, BrandWordmark } from '@/components/brand-logo';
import { rootMetadata, organizationSchema } from '@/lib/seo';
import { DEFAULT_SOCIAL_IMAGE, LOGO_PATH } from '@/lib/seo/seo.constants';

const root = resolve(process.cwd(), '../..');

describe('approved identity', () => {
  it('uses the black icon on light surfaces and preserves its aspect ratio', () => {
    render(<BrandLogo size={30} />);
    const icon = screen.getByRole('img', { name: 'Dealers Drive' });
    expect(icon).toHaveAttribute('src', '/brand/dd-icon-black.svg');
    expect(icon).toHaveAttribute('width', '46');
    expect(icon).toHaveAttribute('height', '30');
    expect(icon).not.toHaveClass('rounded-[32%]');
  });

  it('uses the white identity on dark surfaces with one spoken brand label', () => {
    const { container } = render(<BrandLockup variant="dark" />);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('img')).toHaveAccessibleName('Dealers-Drive');
    expect(
      [...container.querySelectorAll('img')].map((image) => image.getAttribute('src')),
    ).toEqual(['/brand/dd-icon-white.svg', '/brand/dealersdrive-wordmark-white.svg']);
    for (const image of container.querySelectorAll('img')) expect(image).toHaveAttribute('alt', '');
  });

  it('keeps the wordmark independently reusable and reserves intrinsic space', () => {
    render(<BrandWordmark />);
    const wordmark = screen.getByRole('img');
    expect(wordmark).toHaveAttribute('src', '/brand/dealersdrive-wordmark-black.svg');
    expect(wordmark).toHaveAttribute('width', '1092');
    expect(wordmark).toHaveAttribute('height', '145');
  });

  it('validates all shipped masters, derivatives and obsolete references', () => {
    expect(
      execFileSync(process.execPath, ['scripts/verify-brand-assets.mjs'], {
        cwd: root,
        encoding: 'utf8',
      }),
    ).toContain('PASS:');
  });

  it('uses versioned SEO and installation images without conflicting favicon metadata', () => {
    const metadata = rootMetadata();
    expect(metadata).not.toHaveProperty('icons');
    expect(JSON.stringify(metadata.openGraph)).toContain(DEFAULT_SOCIAL_IMAGE.path);
    expect(JSON.stringify(metadata.twitter)).toContain(DEFAULT_SOCIAL_IMAGE.path);
    expect(
      JSON.stringify(organizationSchema({ social: [], supportEmail: '', supportPhone: '' })),
    ).toContain(LOGO_PATH);
    expect(manifest().icons?.map((icon) => icon.src)).toEqual([
      '/brand/dd-icon-v2-192.png',
      '/brand/dd-icon-v2-512.png',
      '/brand/dd-icon-v2-maskable-512.png',
    ]);
  });
});
