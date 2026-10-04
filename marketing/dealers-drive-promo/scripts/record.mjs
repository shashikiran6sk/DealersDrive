import { spawn } from 'node:child_process';
import { PROMO } from './environment.mjs';
const formats = process.argv.slice(2);
if (!formats.length) formats.push('landscape', 'vertical', 'social');
for (const format of formats) {
  if (!['landscape', 'vertical', 'social'].includes(format)) throw Error('Unknown format');
  for (const args of [
    ['scripts/run.mjs', 'prepare'],
    ['scripts/capture.mjs', format],
  ])
    await new Promise((ok, no) => {
      const p = spawn(process.execPath, args, { cwd: PROMO, stdio: 'inherit' });
      p.on('exit', (c) => (c === 0 ? ok() : no(Error(`Command failed ${c}`))));
    });
}
