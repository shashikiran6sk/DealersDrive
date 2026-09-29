import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { PROMO } from './environment.mjs';
import { scenes } from './scenes.mjs';
const format = process.argv[2] || 'landscape';
const dims = {
  landscape: [3840, 2160, 3200, 1688, 320, 300],
  vertical: [1080, 1920, 968, 1452, 56, 330],
  social: [1080, 1350, 960, 986, 60, 265],
}[format];
if (!dims) throw Error('Unknown format');
const [w, h, sw, sh, x, y] = dims;
const root = resolve(PROMO, 'scenes', format),
  exp = resolve(PROMO, 'exports');
await mkdir(exp, { recursive: true });
async function run(args) {
  await new Promise((ok, no) => {
    const p = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      stdio: 'inherit',
    });
    p.on('exit', (c) => (c === 0 ? ok() : no(Error('FFmpeg ' + c))));
  });
}
const enc = [
  '-c:v',
  'libx264',
  '-preset',
  'veryfast',
  '-crf',
  format === 'landscape' ? '19' : '18',
  '-threads',
  '4',
  '-pix_fmt',
  'yuv420p',
  '-r',
  '30',
];
const maps = [
  [],
  [
    ['home', 3],
    ['cars', 6],
  ],
  [['filters', 10]],
  [
    ['portfolio', 3],
    ['gallery', 6],
    ['specifications', 2],
  ],
  [
    ['dealers', 4],
    ['dealer', 5],
  ],
  [
    ['enquiry', 7],
    ['history', 3],
  ],
  [
    ['account', 2],
    ['business', 6],
    ['documents', 3],
  ],
  [
    ['dashboard', 4],
    ['profile', 5],
  ],
  [
    ['inventory', 3],
    ['submit', 5],
    ['reserve', 4],
    ['reactivate', 3],
  ],
  [['inbox', 9]],
  [
    ['cars', 1.2],
    ['gallery', 1.2],
    ['dealer', 1.2],
    ['inventory', 1.2],
    ['inbox', 1.2],
  ],
  [],
];
const finals = [];
const from = Number(process.argv[3] || 0);
for (const [i, s] of scenes.entries()) {
  if (i < from) {
    finals.push(resolve(root, s.id + '.mp4'));
    continue;
  }
  const plate = resolve(root, s.id + '-plate.png'),
    parts = [];
  console.log('Render', format, s.id);
  if (!maps[i].length) {
    const dest = resolve(root, s.id + '-silent.mp4');
    await run([
      '-loop',
      '1',
      '-i',
      plate,
      '-vf',
      `scale=${w}:${h},fade=t=in:st=0:d=0.6,fade=t=out:st=${s.seconds - 0.5}:d=0.5`,
      '-t',
      String(s.seconds),
      ...enc,
      '-an',
      dest,
    ]);
    parts.push(dest);
  }
  for (const [n, [name, seconds]] of maps[i].entries()) {
    const source = resolve(PROMO, 'recordings', format, name, 'frames.ffconcat');
    const concat = await readFile(source, 'utf8');
    const duration = [...concat.matchAll(/duration ([\d.]+)/g)].reduce(
      (a, m) => a + Number(m[1]),
      0,
    );
    const dest = resolve(root, `${s.id}-${n}.mp4`);
    await run([
      '-safe',
      '0',
      '-i',
      source,
      '-loop',
      '1',
      '-i',
      plate,
      '-filter_complex',
      `[0:v]setpts=${(seconds / duration).toFixed(8)}*(PTS-STARTPTS),fps=30,scale=${sw}:${sh}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${sw}:${sh}:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1[ui];[1:v][ui]overlay=${x}:${y}:shortest=1[v]`,
      '-map',
      '[v]',
      '-t',
      String(seconds),
      ...enc,
      '-an',
      dest,
    ]);
    parts.push(dest);
  }
  const list = resolve(root, s.id + '.txt');
  await writeFile(list, parts.map((p) => `file '${p}'`).join('\n'));
  const final = resolve(root, s.id + '.mp4');
  await run([
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    list,
    '-i',
    resolve(PROMO, 'assets/audio/voiceover', s.id + '.wav'),
    '-filter_complex',
    `[1:a]adelay=250|250,apad,atrim=duration=${s.seconds},loudnorm=I=-17:TP=-2:LRA=7[a]`,
    '-map',
    '0:v',
    '-map',
    '[a]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-t',
    String(s.seconds),
    final,
  ]);
  finals.push(final);
}
const list = resolve(root, 'film.txt');
await writeFile(list, finals.map((p) => `file '${p}'`).join('\n'));
const total = scenes.reduce((a, s) => a + s.seconds, 0);
const dest = resolve(
  exp,
  `dealers-drive-promo-${format === 'landscape' ? '4k' : format === 'vertical' ? 'vertical-9x16' : 'social-4x5'}.mp4`,
);
await run([
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  list,
  '-i',
  resolve(PROMO, 'assets/audio/digital-showroom-original.wav'),
  '-filter_complex',
  `[1:a]volume=0.24,afade=t=in:d=2,afade=t=out:st=${total - 3}:d=3[m];[0:a][m]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.89[a]`,
  '-map',
  '0:v',
  '-map',
  '[a]',
  '-c:v',
  'copy',
  '-c:a',
  'aac',
  '-b:a',
  '320k',
  '-ar',
  '48000',
  '-movflags',
  '+faststart',
  '-t',
  String(total),
  dest,
]);
if (format === 'landscape')
  await run([
    '-i',
    dest,
    '-vf',
    'scale=1920:1080:flags=lanczos',
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '18',
    '-threads',
    '4',
    '-c:a',
    'copy',
    '-movflags',
    '+faststart',
    resolve(exp, 'dealers-drive-promo-1080p.mp4'),
  ]);
console.log('Exported', dest);
