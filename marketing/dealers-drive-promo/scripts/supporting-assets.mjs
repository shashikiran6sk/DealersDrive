import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import sharp from 'sharp';
import { PROMO } from './environment.mjs';
import { scenes } from './scenes.mjs';
const durations = JSON.parse(
  await readFile(resolve(PROMO, 'assets/audio/voiceover/durations.json')),
);
const time = (n) => {
  const ms = Math.round(n * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
let offset = 0,
  index = 0,
  srt = '',
  narration = '# Final narration\n\nSynthetic narration: Kokoro af_heart. 111-second edit.\n\n',
  list = '# Scene list\n\n| Start | Length | Scene |\n|---|---:|---|\n';
for (const s of scenes) {
  list += `| ${time(offset).slice(3, 8)} | ${s.seconds}s | ${s.label} |\n`;
  narration += `## ${s.id} — ${s.seconds}s\n\n${s.narration}\n\n`;
  const chunks = s.narration.match(/[^.!?]+[.!?]+/g) || [s.narration];
  const duration = durations.find((d) => d.id === s.id)?.seconds ?? s.seconds - 0.8;
  let local = 0.25;
  const count = chunks.reduce((a, c) => a + c.trim().split(/\s+/).length, 0);
  for (const chunk of chunks) {
    const d = (duration * chunk.trim().split(/\s+/).length) / count;
    const words = chunk.trim().split(' ');
    let lines = [''];
    for (const word of words) {
      if ((lines.at(-1) + ' ' + word).length > 48) lines.push(word);
      else lines[lines.length - 1] += (lines.at(-1) ? ' ' : '') + word;
    }
    srt += `${++index}\n${time(offset + local)} --> ${time(offset + local + d)}\n${lines.join('\n')}\n\n`;
    local += d;
  }
  offset += s.seconds;
}
await writeFile(resolve(PROMO, 'dealers-drive-promo.srt'), srt);
await writeFile(
  resolve(PROMO, 'dealers-drive-promo.vtt'),
  'WEBVTT\n\n' + srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2'),
);
await writeFile(resolve(PROMO, 'narration.md'), narration);
await writeFile(
  resolve(PROMO, 'scene-list.md'),
  list +
    '\nThe customer enquiry is created through the live UI and then marked contacted in the dealer inbox. Social versions use separate responsive viewport captures. Onboarding starts from a seeded post-Google identity; no OAuth exchange is staged.\n',
);
async function walk(dir) {
  const all = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) all.push(...(await walk(p)));
    else if (p.endsWith('.png')) all.push(p);
  }
  return all;
}
const prompts = JSON.parse(await readFile(resolve(PROMO, 'asset-generation.json')));
const studioPrompts = JSON.parse(await readFile(resolve(PROMO, 'studio-generation.json')));
const inventory = [];
for (const file of [
  ...(await walk(resolve(PROMO, 'assets/vehicles'))),
  ...(await walk(resolve(PROMO, 'assets/dealers'))),
  ...(await walk(resolve(PROMO, 'assets/brand'))),
]) {
  const bytes = await readFile(file);
  const meta = await sharp(bytes).metadata();
  const path = relative(PROMO, file);
  const source =
    studioPrompts.find((p) => p.target === path) ?? prompts.find((p) => p.target === path);
  inventory.push({
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    width: meta.width,
    height: meta.height,
    bytes: bytes.length,
    origin: source?.generationDate
      ? `Original OpenAI image generation; white studio edit, ${source.generationDate}`
      : 'Original OpenAI image generation, 2026-09-29',
    prompt:
      source?.prompt ??
      'Original black 2024 Honda Elevate VX front three-quarter dealership photography; right-hand-drive Indian-market vehicle, realistic daylight, blank plate, no watermark.',
    generationReference:
      source?.source?.split('/').at(-1) ?? 'exec-75c5a156-fe87-48fd-bccb-d8cf73a1ee0f.png',
  });
}
await writeFile(resolve(PROMO, 'asset-inventory.json'), JSON.stringify(inventory, null, 2));
console.log(`${inventory.length} original photographs; ${offset}s; ${index} subtitle cues`);
