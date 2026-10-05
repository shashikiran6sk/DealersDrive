import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * R106 — every variable the web build reads reaches the web build.
 *
 * Turbo 2 runs tasks in strict env mode: a variable not declared for the task
 * is removed from its environment. `APP_ENV`, `API_BASE_URL`, `API_ORIGIN` and
 * `WEB_BASE_URL` were set on Vercel and silently stripped, so the production
 * build baked in the "not real data" banner, a localhost canonical URL and no
 * OAuth rewrite — until the build was switched to `--env-mode=loose`.
 *
 * This walks the web app for `process.env.X` and checks each is declared in
 * `apps/web/turbo.json`, except the two that are read only at request time
 * (the health route's version) and `NODE_ENV` (Next sets it; root `globalEnv`).
 */
const WEB = resolve(__dirname, '../..');
const REQUEST_TIME_ONLY = new Set(['GIT_SHA', 'VERCEL_GIT_COMMIT_SHA']);
const SET_BY_NEXT = new Set(['NODE_ENV']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

function envReads(): Set<string> {
  const reads = new Set<string>();
  for (const file of [...sourceFiles(join(WEB, 'src')), join(WEB, 'next.config.ts')]) {
    for (const match of readFileSync(file, 'utf8').matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      if (match[1]) reads.add(match[1]);
    }
  }
  return reads;
}

const turbo = JSON.parse(readFileSync(join(WEB, 'turbo.json'), 'utf8')) as {
  extends?: string[];
  tasks?: { build?: { env?: string[] } };
};
const declared = new Set(turbo.tasks?.build?.env ?? []);

describe('apps/web/turbo.json', () => {
  it('extends the root configuration rather than replacing it', () => {
    expect(turbo.extends).toEqual(['//']);
  });

  it('declares every variable the web build reads', () => {
    const needed = [...envReads()].filter(
      (name) => !REQUEST_TIME_ONLY.has(name) && !SET_BY_NEXT.has(name),
    );
    expect(needed.length).toBeGreaterThan(0);
    for (const name of needed) expect(declared, name).toContain(name);
  });

  it('declares nothing the web app does not read', () => {
    const reads = envReads();
    for (const name of declared) expect(reads, name).toContain(name);
  });
});
