import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const maps = readdirSync(root, { recursive: true }).filter((path) => path.endsWith('.hbc.map'));
assert.equal(maps.length, 1, 'Export Android with --source-maps before this check.');
const map = JSON.parse(readFileSync(resolve(root, maps[0]), 'utf8'));
assert(Array.isArray(map.sources) && map.sources.length > 0);
const forbidden =
  /(?:@prisma\/|\/apps\/(?:api|web)\/|\/contracts\/dist\/(?:index|legal|legal-content)\.js$|node-forge\/|deepmerge-ts\/|mysql2\/|\/braces\/)/;
const failures = map.sources.filter(
  (source) => typeof source !== 'string' || forbidden.test(source),
);
assert.deepEqual(
  failures,
  [],
  'Server/policy archives or build-only dependencies found in native bundle.',
);
console.log(
  `PASS: inspected ${map.sources.length} Android source-map entries for server/archive/build-tool boundaries. This is not a secret scan or device validation.`,
);
