import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import staticFfmpeg from 'ffmpeg-static';
import { SETTINGS, PromoError, sha, fingerprint } from './core.mjs';
const require = createRequire(import.meta.url);
const ffmpeg = process.env.PROMO_FFMPEG || staticFfmpeg;
const audioTasks = new Map();
async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
function command(exe, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(exe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '',
      err = '';
    p.stdout.on('data', (b) => (out += b));
    p.stderr.on('data', (b) => (err += b));
    p.on('error', reject);
    p.on('close', (code) =>
      code
        ? reject(new PromoError('MEDIA', err || `${exe} exited ${code}`))
        : resolve({ out, err }),
    );
  });
}
async function browser() {
  const bundled = await exists(chromium.executablePath());
  try {
    return await chromium.launch({
      ...(bundled ? {} : { channel: 'chrome' }),
      headless: true,
      args: ['--allow-file-access-from-files', '--force-color-profile=srgb'],
    });
  } catch (e) {
    if (/Executable doesn't exist|distribution.*not found/i.test(e.message))
      throw new PromoError('SETUP', 'Chrome/Chromium is missing. Run doctor --install.');
    throw new PromoError(
      'BROWSER_LAUNCH',
      'Browser launch failed. Use permitted browser execution and check system dependencies.',
      { cause: e.message },
    );
  }
}
async function close(b) {
  let timer;
  try {
    await Promise.race([b.close(), new Promise((r) => (timer = setTimeout(r, 5000)))]);
  } finally {
    clearTimeout(timer);
  }
}
export async function doctor({ install = false } = {}) {
  if (Number(process.versions.node.split('.')[0]) < 24)
    throw new PromoError('SETUP', 'Node 24 or newer is required.');
  if (spawnSync('python3', ['--version']).status !== 0)
    throw new PromoError('SETUP', 'Python 3 is required for the original score.');
  if (!(await exists(ffmpeg)) && install)
    await command(process.execPath, [
      path.join(path.dirname(require.resolve('ffmpeg-static/package.json')), 'install.js'),
    ]);
  if (!(await exists(ffmpeg)))
    throw new PromoError('SETUP', 'FFmpeg is missing. Run doctor --install.');
  if (install && !(await exists(chromium.executablePath())))
    await command(process.execPath, [
      path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js'),
      'install',
      'chromium',
    ]);
  const b = await browser();
  await close(b);
  await command(ffmpeg, ['-version']);
  return { node: process.versions.node, ffmpeg, browser: 'ready', python: 'ready' };
}
function inputPaths(root) {
  const repo = path.resolve(root, '../..');
  const inputs = Object.fromEntries(
    [
      'template/index.html',
      'template/motion.js',
      'src/core.mjs',
      'src/media.mjs',
      'src/score.py',
      'package-lock.json',
    ].map((p) => [p, path.join(root, p)]),
  );
  for (const [local, source] of [
    ['icon-black.svg', 'dd-icon-black.svg'],
    ['icon-white.svg', 'dd-icon-white.svg'],
    ['wordmark-black.svg', 'dealersdrive-wordmark-black.svg'],
    ['wordmark-white.svg', 'dealersdrive-wordmark-white.svg'],
  ])
    inputs['brand/' + local] = path.join(repo, 'apps/web/public/brand', source);
  inputs['brand/manrope.woff2'] = path.join(repo, 'apps/web/src/lib/fonts/manrope-variable.woff2');
  return inputs;
}
export async function styleKey(root) {
  const data = {};
  for (const [name, p] of Object.entries(inputPaths(root))) data[name] = sha(await fs.readFile(p));
  return fingerprint({ data, settings: SETTINGS });
}
export async function snapshot(root, dir) {
  for (const [name, p] of Object.entries(inputPaths(root))) {
    const destination = name.startsWith('brand/')
      ? path.join(dir, 'assets', name)
      : name.startsWith('template/')
        ? path.join(dir, name)
        : null;
    if (destination) {
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(p, destination);
    }
  }
  return styleKey(root);
}
export async function imageExtension(bytes) {
  const meta = await sharp(bytes).metadata();
  if (!['webp', 'jpeg', 'png'].includes(meta.format) || !meta.width || !meta.height)
    throw new PromoError('INVALID_MEDIA', 'Use actual raster vehicle photographs.');
  return meta.format === 'jpeg' ? 'jpg' : meta.format;
}
const xml = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export async function contactSheet(dir, capture) {
  const w = 360,
    h = 300,
    cols = 3,
    rows = Math.ceil(capture.images.length / cols),
    tiles = [];
  for (let i = 0; i < capture.images.length; i++) {
    const image = capture.images[i],
      x = (i % cols) * w,
      y = Math.floor(i / cols) * (h + 30);
    tiles.push({
      input: await sharp(path.join(dir, 'media', image.file))
        .resize(w, h, { fit: 'contain', background: '#eee' })
        .png()
        .toBuffer(),
      left: x,
      top: y + 30,
    });
    tiles.push({
      input: Buffer.from(
        `<svg width="${w}" height="30"><rect width="100%" height="100%" fill="#ddd"/><text x="10" y="22" font-family="Arial" font-size="17">${i + 1}. ${xml(image.hash.slice(0, 12))}</text></svg>`,
      ),
      left: x,
      top: y,
    });
  }
  await fs.mkdir(path.join(dir, 'review'), { recursive: true });
  await sharp({
    create: { width: cols * w, height: rows * (h + 30), channels: 3, background: '#eee' },
  })
    .composite(tiles)
    .jpeg({ quality: 92 })
    .toFile(path.join(dir, 'review', capture.facts.slug + '-gallery.jpg'));
}
async function pageFor(dir, car, format) {
  const b = await browser(),
    page = await b.newPage({ viewport: SETTINGS.formats[format], deviceScaleFactor: 1 }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.addInitScript({ content: 'window.VEHICLE=' + JSON.stringify(car) });
    await page.goto(
      pathToFileURL(path.join(dir, 'template/index.html')).href + '?layout=' + format,
    );
    await page.evaluate(() => window.ready);
    return { b, page, errors };
  } catch (e) {
    await close(b);
    throw e;
  }
}
export async function preview(dir, car, format) {
  const { b, page, errors } = await pageFor(dir, car, format),
    times = [1, 3, 7.5, 10, 12, 15, 17, 19],
    tiles = [];
  const output = path.join(dir, 'review', car.slug + '-' + format + '-preview.jpg'),
    w = format === 'vertical' ? 270 : 480,
    h = Math.round((w * SETTINGS.formats[format].height) / SETTINGS.formats[format].width);
  try {
    for (let i = 0; i < times.length; i++) {
      await page.evaluate((t) => window.seek(t), times[i]);
      const layout = await page.evaluate(() => {
        const photos = [...document.querySelectorAll('.photo')]
          .filter((p) => Number(getComputedStyle(p).opacity) > 0.9)
          .map((p) => p.getBoundingClientRect());
        return [...document.querySelectorAll('.mask .title')].flatMap((e) => {
          const r = document.createRange();
          r.selectNodeContents(e);
          const t = r.getBoundingClientRect();
          return e.scrollWidth > e.clientWidth + 4 ||
            photos.some(
              (p) =>
                t.right > p.left + 2 &&
                t.left < p.right - 2 &&
                t.bottom > p.top + 2 &&
                t.top < p.bottom - 2,
            )
            ? [e.innerText]
            : [];
        });
      });
      if (layout.length)
        throw new PromoError(
          'LAYOUT',
          `${format} at ${times[i]}s: a headline is clipped or covered: ${layout.join(', ')}`,
        );
      const shot = await page.screenshot({ type: 'png' });
      tiles.push({
        input: await sharp(shot).resize(w, h).png().toBuffer(),
        left: (i % 4) * w,
        top: Math.floor(i / 4) * h,
      });
    }
    if (errors.length) throw new PromoError('LAYOUT', errors.join('\n'));
    await sharp({ create: { width: w * 4, height: h * 2, channels: 3, background: '#ddd' } })
      .composite(tiles)
      .jpeg({ quality: 92 })
      .toFile(output);
    return { car: car.slug, format, path: output, layoutErrors: [] };
  } finally {
    await close(b);
  }
}
async function audio(dir) {
  // Each job gets its own atomic score output; concurrent orientations share this promise.
  if (!audioTasks.has(dir))
    audioTasks.set(
      dir,
      (async () => {
        const root = fileURLToPath(new URL('..', import.meta.url)),
          out = path.join(dir, 'assets/audio');
        await fs.mkdir(out, { recursive: true });
        await command('python3', [path.join(root, 'src/score.py'), out]);
        const master = path.join(out, 'vehicle-master.wav');
        await command(ffmpeg, [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          path.join(out, 'vehicle-original.wav'),
          '-af',
          'loudnorm=I=-14:TP=-1.5:LRA=7',
          '-ar',
          '48000',
          '-c:a',
          'pcm_s24le',
          master,
        ]);
        return master;
      })(),
    );
  try {
    return await audioTasks.get(dir);
  } catch (e) {
    audioTasks.delete(dir);
    throw e;
  }
}
export async function render(dir, car, format, destination) {
  const soundtrack = await audio(dir),
    { b, page, errors } = await pageFor(dir, car, format);
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'image2pipe',
    '-vcodec',
    'mjpeg',
    '-framerate',
    String(SETTINGS.fps),
    '-i',
    'pipe:0',
    '-i',
    soundtrack,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '17',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(SETTINGS.fps),
    '-t',
    String(SETTINGS.duration),
    '-c:a',
    'aac',
    '-b:a',
    '320k',
    '-ar',
    '48000',
    '-movflags',
    '+faststart',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-colorspace',
    'bt709',
    '-threads',
    '2',
    destination,
  ];
  const encoder = spawn(ffmpeg, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let log = '';
  encoder.stderr.on('data', (v) => (log += v));
  encoder.stdin.on('error', () => {});
  const done = new Promise((resolve, reject) => {
    encoder.on('error', reject);
    encoder.on('exit', (code) => (code ? reject(new PromoError('ENCODE', log)) : resolve()));
  });
  done.catch(() => {});
  try {
    for (let frame = 0; frame < SETTINGS.fps * SETTINGS.duration; frame++) {
      await page.evaluate((t) => window.seek(t), frame / SETTINGS.fps);
      const image = await page.screenshot({ type: 'jpeg', quality: 97 });
      if (!encoder.stdin.write(image))
        await Promise.race([
          once(encoder.stdin, 'drain'),
          done.then(() => {
            throw new PromoError('ENCODE', 'Encoder ended before all frames.');
          }),
        ]);
    }
    encoder.stdin.end();
    await done;
    if (errors.length) throw new PromoError('ENCODE', errors.join('\n'));
  } catch (e) {
    encoder.kill('SIGTERM');
    await done.catch(() => {});
    throw e;
  } finally {
    await close(b);
  }
}
export async function verify(file, format) {
  const v = SETTINGS.formats[format];
  const decoded = await command(ffmpeg, [
    '-hide_banner',
    '-xerror',
    '-i',
    file,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0',
    '-progress',
    'pipe:1',
    '-nostats',
    '-f',
    'null',
    '-',
  ]);
  const frames = Number([...decoded.out.matchAll(/^frame=(\d+)/gm)].at(-1)?.[1]);
  const time = decoded.err.match(/Duration: (\d+):(\d+):([\d.]+)/),
    duration = time ? Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]) : NaN;
  if (
    !decoded.err.includes(`${v.width}x${v.height}`) ||
    !decoded.err.includes(`${SETTINGS.fps} fps`) ||
    !decoded.err.includes('Video: h264') ||
    !decoded.err.includes('Audio: aac') ||
    frames !== SETTINGS.fps * SETTINGS.duration ||
    Math.abs(duration - SETTINGS.duration) > 0.03 ||
    !Number.isFinite(duration)
  )
    throw new PromoError('VERIFY', 'Unexpected movie dimensions, streams, frames or duration.');
  const a = await command(ffmpeg, [
    '-hide_banner',
    '-i',
    file,
    '-vn',
    '-af',
    'loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json',
    '-f',
    'null',
    '-',
  ]);
  const loudness = JSON.parse(a.err.slice(a.err.lastIndexOf('{')));
  if (
    Number(loudness.input_tp) > -0.8 ||
    Number(loudness.input_i) < -17 ||
    Number(loudness.input_i) > -12
  )
    throw new PromoError('VERIFY', 'Audio is outside the approved bounds.');
  return {
    verified: true,
    ...v,
    frames,
    fps: SETTINGS.fps,
    duration,
    bytes: (await fs.stat(file)).size,
    sha256: sha(await fs.readFile(file)),
    loudness,
  };
}
export async function packageJob(dir) {
  const script = path.join(fileURLToPath(new URL('..', import.meta.url)), 'src/package.py');
  const { out } = await command('python3', [script, dir]);
  return JSON.parse(out);
}
