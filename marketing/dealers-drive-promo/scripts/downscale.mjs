#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';

import { FFMPEG } from './lib/ffmpeg.mjs';

const [input, output] = process.argv.slice(2);
if (!input || !output || !existsSync(input)) {
  console.error('usage: downscale.mjs <4k.mp4> <1080p.mp4>');
  process.exit(1);
}
const result = spawnSync(
  FFMPEG,
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    input,
    '-vf',
    'scale=1920:1080:flags=lanczos',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '17',
    '-pix_fmt',
    'yuv420p',
    '-profile:v',
    'high',
    '-movflags',
    '+faststart',
    '-an',
    output,
  ],
  { stdio: 'inherit' },
);
if (result.status !== 0) process.exit(result.status ?? 1);
const srt = input.replace(/\.mp4$/, '.srt');
if (existsSync(srt)) copyFileSync(srt, output.replace(/\.mp4$/, '.srt'));
console.log(`Wrote ${output}`);
