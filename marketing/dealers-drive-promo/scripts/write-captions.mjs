#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { buildTimeline } = await import(pathToFileURL(join(root, 'film', 'timeline.mjs')).href);
for (const [format, file] of [
  ['landscape', 'captions.srt'],
  ['portrait', 'captions-9x16.srt'],
]) {
  const timeline = await buildTimeline({ format, root });
  await writeFile(join(root, 'film', file), timeline.srt);
  console.log(
    `film/${file}: ${String(timeline.narration.length)} lines, ${timeline.duration.toFixed(1)}s`,
  );
}
