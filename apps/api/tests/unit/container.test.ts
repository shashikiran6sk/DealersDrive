import { describe, expect, it } from 'vitest';

import { buildContainer, closeContainer, startBackground } from '../../src/container.js';

/**
 * The composition root. Every dependency is constructed here and passed down
 * as a plain argument, so the thing worth testing is the seam: an override
 * given to `buildContainer` must be the instance a module receives, or the
 * test suite is not testing what production runs.
 *
 * ── Reconstruction note ───────────────────────────────────────────────────
 * F002 lands the shape with one field. The override seams the suite actually
 * leans on — `prisma` (F005), `cache` (F028), `storage` (F032), `oauth`
 * (F018), `rc` (F057) — are asserted by the features that add them.
 */
describe('buildContainer', () => {
  it('builds a container', async () => {
    const container = await buildContainer();

    expect(container.env).toBeDefined();
  });

  it('reads configuration from the environment by default', async () => {
    const container = await buildContainer();

    expect(container.env.NODE_ENV).toBe('test');
  });

  /** The seam every later feature widens: an override must win over the default. */
  it('prefers an override to the default', async () => {
    const env = { ...(await buildContainer()).env, PORT: 4321 };

    const container = await buildContainer({ env });

    expect(container.env.PORT).toBe(4321);
  });
});

describe('lifecycle', () => {
  it('starts background work without anything registered', async () => {
    await expect(startBackground(await buildContainer())).resolves.toBeUndefined();
  });

  it('closes a container that holds nothing open', async () => {
    await expect(closeContainer(await buildContainer())).resolves.toBeUndefined();
  });
});
