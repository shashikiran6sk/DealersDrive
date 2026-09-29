#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from 'playwright-core';

import { CHROMIUM } from '../art/raster.mjs';
import { FFMPEG } from './lib/ffmpeg.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;

const FORMATS = {
  landscape: { width: 3840, height: 2160 },
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1920 },
};

const format = arg('format', 'landscape');
const fps = Number(arg('fps', '30'));
const workers = Number(arg('workers', '3'));
const out = resolve(arg('out', join(root, 'exports', `render-${format}.mp4`)));
const captions = !process.argv.includes('--no-captions');
const from = Number(arg('from', '0'));
const until = arg('until', null);
const { width, height } = FORMATS[format];

const { buildTimeline } = await import(pathToFileURL(join(root, 'film', 'timeline.mjs')).href);
const timeline = await buildTimeline({ format, captions, root });
const total = until ? Math.min(Number(until), timeline.duration) : timeline.duration;
const frames = Math.round((total - from) * fps);
console.log(
  `Rendering ${format} ${String(width)}x${String(height)} @${String(fps)}fps — ${total.toFixed(2)}s, ${String(frames)} frames, ${String(workers)} workers`,
);

const segDir = join(dirname(out), `.segments-${format}`);
await rm(segDir, { recursive: true, force: true });
await mkdir(segDir, { recursive: true });

function encoder(file) {
  const ff = spawn(
    FFMPEG,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'image2pipe',
      '-framerate',
      String(fps),
      '-c:v',
      'mjpeg',
      '-i',
      '-',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      format === 'landscape' ? '15' : '16',
      '-pix_fmt',
      'yuv420p',
      '-profile:v',
      'high',
      '-tune',
      'animation',
      '-x264-params',
      `keyint=${String(fps * 2)}:min-keyint=${String(fps)}`,
      '-movflags',
      '+faststart',
      file,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  const done = new Promise((res, rej) =>
    ff.on('close', (code) =>
      code === 0 ? res() : rej(new Error(`ffmpeg exited ${String(code)}`)),
    ),
  );
  return { ff, done };
}

async function renderSegment(index, first, last) {
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      '--allow-file-access-from-files',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--font-render-hinting=none',
    ],
  });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(`stage error: ${e.message}`));
  await page.goto(pathToFileURL(join(root, 'film', 'stage', 'stage.html')).href);
  const info = await page.evaluate((cfg) => window.setupFilm(cfg), {
    width,
    height,
    format,
    clips: timeline.clips,
  });
  if (info.broken.length) throw new Error(`Stage could not load: ${info.broken.join(', ')}`);
  const cdp = await page.context().newCDPSession(page);
  const file = join(segDir, `seg-${String(index).padStart(3, '0')}.mp4`);
  const { ff, done } = encoder(file);
  const started = Date.now();
  for (let f = first; f < last; f += 1) {
    const t = from + f / fps;
    await page.evaluate((time) => window.renderAt(time), t);
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 95,
      optimizeForSpeed: false,
      captureBeyondViewport: false,
    });
    const buffer = Buffer.from(shot.data, 'base64');
    if (!ff.stdin.write(buffer)) await new Promise((r) => ff.stdin.once('drain', r));
    const n = f - first + 1;
    if (n % 150 === 0)
      console.log(
        `  [w${String(index)}] ${String(n)}/${String(last - first)} (${(n / ((Date.now() - started) / 1000)).toFixed(1)} fps)`,
      );
  }
  ff.stdin.end();
  await done;
  await browser.close();
  return file;
}

const per = Math.ceil(frames / workers);
const segments = await Promise.all(
  Array.from({ length: workers }, (_, i) => [i, i * per, Math.min(frames, (i + 1) * per)])
    .filter(([, a, b]) => b > a)
    .map(([i, a, b]) => renderSegment(i, a, b)),
);

const list = join(segDir, 'list.txt');
await writeFile(list, segments.map((s) => `file '${s}'`).join('\n'));
await mkdir(dirname(out), { recursive: true });
await new Promise((res, rej) => {
  const ff = spawn(
    FFMPEG,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      list,
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      out,
    ],
    { stdio: 'inherit' },
  );
  ff.on('close', (code) => (code === 0 ? res() : rej(new Error(`concat exited ${String(code)}`))));
});
await rm(segDir, { recursive: true, force: true });
if (timeline.srt) await writeFile(out.replace(/\.mp4$/, '.srt'), timeline.srt);
console.log(`Wrote ${out}${existsSync(out) ? '' : ' (missing!)'}`);
