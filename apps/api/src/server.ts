import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import type { Container } from './container.js';
import { requestContext } from './middleware/request-context.js';
import { requestLogger } from './middleware/request-logger.js';
import { createRoutes } from './routes.js';

/**
 * Express app assembly, and nothing else. No routes are defined here, no
 * business logic, no listening — that is index.ts's job, which keeps the app
 * importable from tests without opening a port.
 *
 * The middleware order IS the security model. Do not reorder casually:
 *   1. request-context  — first, so everything below has a traceId, including
 *                         errors thrown by the body parser
 *   2. helmet / cors    — reject before doing any work
 *   3. body parsers     — bounded, so a huge body cannot exhaust memory
 *      + cookie parser    — before routes, so the session resolver can read it
 *   4. request-logger   — after context, so its lines carry the traceId
 *   5. routes
 *   6. not-found        — anything unmatched becomes a NotFoundError    [F003]
 *   7. error-handler    — last, always                                  [F003]
 *
 * ── Reconstruction note ───────────────────────────────────────────────────
 * Positions 6 and 7 are not here yet. F003 adds not-found and error-handler,
 * in the positions the comment gives them — the ordering is the security
 * model, not a style choice.
 */
export function createApp(container: Container): Express {
  const app = express();

  // Behind Render/Cloudflare: trust exactly one proxy hop so req.ip is the
  // real client, not the load balancer.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestContext);

  app.use(helmet());
  app.use(
    cors({
      origin: env.webOrigins,
      credentials: true,
      maxAge: 86_400,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  // Unsigned: the session cookie's value is a random token verified against the
  // database, and the OAuth cookie carries its own HMAC. Neither needs express
  // to sign anything, and a signing secret here would imply a guarantee the
  // session design does not rely on.
  app.use(cookieParser());

  app.use(requestLogger);

  app.use(createRoutes(container));

  return app;
}
