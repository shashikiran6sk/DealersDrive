import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

import { buildPostmanCollection, buildPostmanEnvironment } from './postman.js';

/**
 * Writes the Postman collection and environment into `docs/postman/`.
 *
 *   pnpm docs:postman
 *
 * The output is committed so a tester can import it without running anything,
 * and `tests/postman.test.ts` fails if the committed file has drifted from the
 * OpenAPI document — which is the only thing that keeps a committed artifact
 * honest.
 */

export const COLLECTION_PATH = 'docs/postman/dealers-drive.postman_collection.json';
export const ENVIRONMENT_PATH = 'docs/postman/dealers-drive.postman_environment.json';

/** Stable formatting, so a regeneration with no changes is an empty diff. */
export function serialise(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** `apps/api` → the repo root, whichever directory the script was run from. */
export function repoRoot(): string {
  return resolve(import.meta.dirname, '../../../..');
}

async function main(): Promise<void> {
  const root = repoRoot();

  const files: [string, unknown][] = [
    [COLLECTION_PATH, buildPostmanCollection()],
    [ENVIRONMENT_PATH, buildPostmanEnvironment()],
  ];

  for (const [relative, contents] of files) {
    const target = resolve(root, relative);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, serialise(contents), 'utf8');
    console.warn(`wrote ${relative}`);
  }
}

/**
 * Only when run as a script. `tests/postman.test.ts` imports `serialise` and the
 * paths from this module to check the committed file for drift — if importing it
 * also *wrote* that file, the check would compare the output to itself and pass
 * unconditionally.
 */
if (process.argv[1] !== undefined && import.meta.filename === resolve(process.argv[1])) {
  await main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
