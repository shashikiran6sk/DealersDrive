import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import type { Container } from './container.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { requestContext } from './middleware/request-context.js';
import { requestLogger } from './middleware/request-logger.js';
import { requestMetrics } from './middleware/request-metrics.js';
import { createRoutes } from './routes.js';

export function createApp(container: Container): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestContext);
  app.use(requestMetrics);

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
  app.use(cookieParser());

  app.use(requestLogger);

  app.use(createRoutes(container));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
