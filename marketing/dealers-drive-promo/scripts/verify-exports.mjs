import { spawn } from 'node:child_process';
import { writeFile, stat, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { PROMO } from './environment.mjs';
const files = [
  ['4k', 3840, 2160],
  ['1080p', 1920, 1080],
  ['vertical-9x16', 1080, 1920],
  ['social-4x5', 1080, 1350],
];
const results = [];
const run = (args) =>
  new Promise((ok, no) => {
    const p = spawn(ffmpeg, ['-hide_banner', ...args]);
    let log = '';
    p.stderr.on('data', (d) => (log += d));
    p.on('error', no);
    p.on('exit', (code) => ok({ code, log }));
  });
await mkdir(resolve(PROMO, 'scenes/qa'), { recursive: true });
for (const [name, w, h] of files) {
  const file = resolve(PROMO, 'exports', `dealers-drive-promo-${name}.mp4`);
  const probe = await run(['-i', file]);
  if (
    !probe.log.includes(`${w}x${h}`) ||
    !probe.log.includes('30 fps') ||
    !probe.log.includes('Audio: aac')
  )
    throw Error('Unexpected media format ' + name + '\n' + probe.log);
  const duration = probe.log.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const seconds = Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
  if (Math.abs(seconds - 111) > 0.2) throw Error('Unexpected duration ' + seconds);
  const decoded = await run(['-v', 'error', '-i', file, '-f', 'null', '-']);
  if (decoded.code || decoded.log.trim()) throw Error('Decode errors ' + decoded.log);
  const levels = await run([
    '-i',
    file,
    '-vn',
    '-af',
    'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json',
    '-f',
    'null',
    '-',
  ]);
  const metrics = JSON.parse(levels.log.slice(levels.log.lastIndexOf('{')));
  if (Number(metrics.input_tp) > 0) throw Error('Audio clipping ' + name);
  await run([
    '-y',
    '-ss',
    '30',
    '-i',
    file,
    '-frames:v',
    '1',
    resolve(PROMO, 'scenes/qa', name + '.png'),
  ]);
  results.push({
    file: name,
    width: w,
    height: h,
    fps: 30,
    seconds,
    bytes: (await stat(file)).size,
    decode: 'pass',
    audio: metrics,
  });
  console.log(name, 'pass', seconds, 'seconds', metrics.input_i, 'LUFS', metrics.input_tp, 'dBTP');
}
await writeFile(resolve(PROMO, 'export-verification.json'), JSON.stringify(results, null, 2));
