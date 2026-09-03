import process from 'node:process';

import { env } from './config/env.js';
import { buildContainer, startBackground } from './container.js';
import { createApp } from './server.js';

/**
 * The process entry point: build the container, assemble the app, listen.
 *
 * ── Reconstruction note ───────────────────────────────────────────────────
 * F004 brings the rest of this file back — the structured pino startup line,
 * the keep-alive timeouts and the SIGTERM drain. Nothing is logged here in the
 * meantime: a `console.log` would only be removed two features later, and the
 * lint rule that forbids it is the one keeping pino the single log path.
 */
const container = await buildContainer();
await startBackground(container);

const app = createApp(container);

app.listen(env.PORT, env.HOST);

process.on('SIGTERM', () => {
  process.exit(0);
});
