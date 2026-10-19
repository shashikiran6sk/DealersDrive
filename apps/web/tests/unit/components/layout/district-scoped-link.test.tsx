import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { setLocation } from '../../../setup';

import { DistrictScopedLink, scopedHref } from '@/components/layout/district-scoped-link';
import { scopedPathOf } from '@/components/layout/district-picker';

afterEach(() => setLocation('/'));

describe('scopedHref', () => {
  it('adds the district, keeping any query the link already had', () => {
    expect(scopedHref('/dealers', 'vellore')).toBe('/dealers?district=vellore');
    expect(scopedHref('/cars?sort=price_asc', 'ranipet')).toBe(
      '/cars?sort=price_asc&district=ranipet',
    );
  });

  it('leaves the link alone with no district, or one that is not a slug', () => {
    expect(scopedHref('/dealers', null)).toBe('/dealers');
    expect(scopedHref('/dealers', 'Not A Slug')).toBe('/dealers');
  });
});

describe('DistrictScopedLink', () => {
  it('carries the home page district to the directory', () => {
    setLocation('/', 'district=vellore');
    render(<DistrictScopedLink href="/dealers">Browse dealers</DistrictScopedLink>);
    expect(screen.getByRole('link', { name: 'Browse dealers' })).toHaveAttribute(
      'href',
      '/dealers?district=vellore',
    );
  });

  it('is a plain link when no district is chosen', () => {
    setLocation('/');
    render(<DistrictScopedLink href="/cars">Browse all cars</DistrictScopedLink>);
    expect(screen.getByRole('link', { name: 'Browse all cars' })).toHaveAttribute('href', '/cars');
  });
});

describe('scopedPathOf (F114)', () => {
  it('keeps Home, Cars and the directory where they are', () => {
    expect(scopedPathOf('/')).toBe('/');
    expect(scopedPathOf('/cars')).toBe('/cars');
    expect(scopedPathOf('/dealers')).toBe('/dealers');
  });

  it('sends a single car to /cars and a single dealership or any other page to the directory', () => {
    expect(scopedPathOf('/car/2023-hyundai-creta')).toBe('/cars');
    expect(scopedPathOf('/dealers/sri-lakshmi-motors')).toBe('/dealers');
    expect(scopedPathOf('/saved')).toBe('/dealers');
  });
});
