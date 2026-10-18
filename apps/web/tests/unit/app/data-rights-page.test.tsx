import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as navigation from 'next/navigation';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof navigation>()),
  notFound,
}));
vi.mock('@/features/legal/rights-controls', () => ({ RightsControls: () => null }));

import DataRightsPage from '@/app/(public)/data-rights/page';

const searchParams = () => Promise.resolve({});

afterEach(() => {
  vi.unstubAllEnvs();
  notFound.mockClear();
});

describe('privacy controls page', () => {
  it('is not published in production while the legal release is unapproved', async () => {
    vi.stubEnv('APP_ENV', 'production');
    await expect(DataRightsPage({ searchParams: searchParams() })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    vi.stubEnv('APP_ENV', 'preview');
    vi.stubEnv('VERCEL_ENV', 'production');
    await expect(DataRightsPage({ searchParams: searchParams() })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  it('renders outside production for review', async () => {
    vi.stubEnv('APP_ENV', 'preview');
    vi.stubEnv('VERCEL_ENV', 'preview');
    await expect(DataRightsPage({ searchParams: searchParams() })).resolves.toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });
});
