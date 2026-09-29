import { KokoroTTS } from 'kokoro-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PROMO } from './environment.mjs';
import { scenes } from './scenes.mjs';

const out = resolve(PROMO, 'assets/audio/voiceover');
await mkdir(out, { recursive: true });
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
  dtype: 'q8',
  device: 'cpu',
  cache_dir: resolve(PROMO, '.cache/kokoro'),
});
const report = [];
for (const scene of scenes) {
  const audio = await tts.generate(scene.narration, { voice: 'af_heart', speed: 1.04 });
  await audio.save(resolve(out, `${scene.id}.wav`));
  report.push({ id: scene.id, seconds: audio.audio.length / audio.sampling_rate });
  console.log(report.at(-1));
}
await writeFile(resolve(out, 'durations.json'), JSON.stringify(report, null, 2));
