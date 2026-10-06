import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * R105 — where the web tier's server code runs.
 *
 * The API and its database are in AWS ap-south-1 (Mumbai). Vercel runs a
 * project's functions in `iad1` (Washington, D.C.) unless told otherwise, which
 * put every server render, Server Action and API call on an India → US → Mumbai
 * round trip of roughly 200 ms, and ~600 ms when a fresh TLS connection was
 * needed. `bom1` is Vercel's Mumbai region, on AWS ap-south-1 itself.
 */
const config = JSON.parse(readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8')) as {
  regions?: unknown;
  git?: { deploymentEnabled?: { main?: unknown } };
};

describe('apps/web/vercel.json', () => {
  it('runs the functions in Mumbai, next to the API and the database', () => {
    expect(config.regions).toEqual(['bom1']);
  });

  it('still does not deploy main by itself — deploys stay with the release workflow', () => {
    expect(config.git?.deploymentEnabled?.main).toBe(false);
  });
});
