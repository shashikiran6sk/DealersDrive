import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Next.js rewrites', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('proxies dealer and admin Google OAuth routes through the public web origin', async () => {
    vi.stubEnv('API_ORIGIN', 'https://api.dealers-drive.com');

    const { default: config } = await import('../../next.config');

    await expect(config.rewrites?.()).resolves.toEqual([
      {
        source: '/v1/auth/google/:path*',
        destination: 'https://api.dealers-drive.com/v1/auth/google/:path*',
      },
      {
        source: '/v1/auth/admin/google/:path*',
        destination: 'https://api.dealers-drive.com/v1/auth/admin/google/:path*',
      },
    ]);
  });
});
