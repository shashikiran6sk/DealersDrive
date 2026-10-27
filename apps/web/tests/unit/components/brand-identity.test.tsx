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
    render(<BrandLogo />);
    const icon = screen.getByRole('img', { name: 'Dealers Drive' });
    expect(icon).toHaveAttribute('src', '/brand/dd-icon-black.svg');
    expect(icon).toHaveAttribute('width', '37');
    expect(icon).toHaveAttribute('height', '24');
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

  it('uses versioned favicon, SEO and installation images', () => {
    const metadata = rootMetadata();
    expect(metadata.icons).toEqual({
      icon: [
        { url: '/favicon-v2.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
        { url: '/brand/dd-favicon-v2-48.png', sizes: '48x48', type: 'image/png' },
        { url: '/brand/dd-favicon-v2-96.png', sizes: '96x96', type: 'image/png' },
        { url: '/brand/dd-icon-v2-192.png', sizes: '192x192', type: 'image/png' },
      ],
      apple: [{ url: '/brand/dd-apple-icon-v2-180.png', sizes: '180x180', type: 'image/png' }],
    });
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
