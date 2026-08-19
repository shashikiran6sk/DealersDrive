import { afterEach, describe, expect, it } from 'vitest';

import { GET } from '@/app/api/health/route';

/**
 * The probe the load balancer polls. Two things are worth holding still: it
 * answers without touching the API, and it reports the commit it was built
 * from — the deploy pipeline reads that field to decide whether the new tasks
 * are actually serving.
 */
const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('GET /api/health', () => {
  it('answers 200 with the environment and the build it came from', async () => {
    process.env.APP_ENV = 'dev';
    process.env.GIT_SHA = 'abc123';

    const response = GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      appEnv: 'dev',
      version: 'abc123',
    });
  });

  /** An unbuilt image — `pnpm dev` — has no commit, and must still be healthy. */
  it('reports `unknown` rather than failing when GIT_SHA is absent', async () => {
    delete process.env.GIT_SHA;
    delete process.env.APP_ENV;

    const body = (await GET().json()) as { appEnv: string; version: string };
    expect(body).toMatchObject({ appEnv: 'local', version: 'unknown' });
  });
});
