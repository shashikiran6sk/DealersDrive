import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const forbidden =
  /(?:from\s*|import\s*\(|require\s*\()\s*['"](?:next(?:\/|['"])|node:|@prisma\/|@dealers-drive\/(?:api|web)|@dealers-drive\/contracts['"])/;
const unsafeEnvironment = /process\.env\.(?!EXPO_PUBLIC_)[A-Z][A-Z0-9_]*/;
const failures = [];
for (const directory of ['app', 'src']) {
  for (const entry of readdirSync(resolve(root, directory), {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile() || !/\.[jt]sx?$/.test(entry.name)) continue;
    const path = resolve(entry.parentPath, entry.name);
    const source = readFileSync(path, 'utf8');
    if (forbidden.test(source) || unsafeEnvironment.test(source)) failures.push(path);
  }
}
if (failures.length) {
  console.error('Mobile boundary violation:', failures);
  process.exitCode = 1;
} else {
  console.log('Mobile source boundaries passed.');
}
