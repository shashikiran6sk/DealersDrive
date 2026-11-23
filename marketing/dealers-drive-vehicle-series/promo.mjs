#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import { PromoError } from './src/core.mjs';
const require = createRequire(import.meta.url);
try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      install: { type: 'boolean' },
      fixture: { type: 'string' },
      car: { type: 'string' },
      roles: { type: 'string' },
    },
  });
  const [action, ...args] = positionals;
  if (!action || action === 'help') {
    console.log(
      'promo.mjs doctor [--install] | prepare <URL...> | select <job> --car <slug> --roles <JSON> | preview <job> | render <job> | deliver <job> | status <job>',
    );
    process.exit(0);
  }
  for (const dependency of ['playwright', 'sharp', 'ffmpeg-static'])
    try {
      require.resolve(dependency);
    } catch {
      throw new PromoError(
        'SETUP',
        'Run npm ci --ignore-scripts in marketing/dealers-drive-vehicle-series, then node promo.mjs doctor --install.',
      );
    }
  const { Workflow } = await import('./src/workflow.mjs');
  const workflow = new Workflow({ fixture: values.fixture });
  let result;
  if (action === 'doctor') {
    const { doctor } = await import('./src/media.mjs');
    result = await doctor({ install: values.install });
  } else if (action === 'prepare') result = await workflow.prepare(args);
  else if (action === 'select') {
    if (!args[0] || !values.roles)
      throw new PromoError('ARGS', 'select requires a job id and --roles JSON.');
    result = await workflow.select(args[0], values.car, JSON.parse(values.roles));
  } else if (['preview', 'render', 'deliver'].includes(action)) {
    if (args.length !== 1) throw new PromoError('ARGS', action + ' requires one job id.');
    result = await workflow[action](args[0]);
  } else if (action === 'status') {
    if (args.length !== 1) throw new PromoError('ARGS', 'status requires one job id.');
    const { dir, job } = await workflow.job(args[0]);
    result = { ...job, directory: dir };
  } else throw new PromoError('ARGS', 'Unknown action. Run promo.mjs help.');
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
} catch (error) {
  console.error(
    JSON.stringify({
      error: error.code || 'FAILED',
      message: error.message,
      details: error.details,
    }),
  );
  process.exit(1);
}
