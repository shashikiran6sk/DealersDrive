import { Router } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { stringify } from 'yaml';

import { buildOpenApiDocument } from './openapi.js';

export function createDocsRouter(): Router {
  const router = Router();
  const document = buildOpenApiDocument();

  router.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
        },
      },
    }),
  );

  router.get('/openapi.json', (_req, res) => {
    res.type('application/json').send(JSON.stringify(document, null, 2));
  });

  router.get('/openapi.yaml', (_req, res) => {
    res.type('application/yaml').send(stringify(document));
  });

  router.use(
    '/',
    swaggerUi.serveFiles(document, {}),
    swaggerUi.setup(document, {
      customSiteTitle: 'Dealers-Drive API',
      customCss: `
        .swagger-ui .renderedMarkdown table { border-collapse: collapse; margin: 12px 0; }
        .swagger-ui .renderedMarkdown table th,
        .swagger-ui .renderedMarkdown table td { border: 1px solid #d3dce6; padding: 5px 10px; }
        .swagger-ui .renderedMarkdown table th { background: #f0f4f8; text-align: left; }
      `,
      swaggerOptions: {
        docExpansion: 'none',
        operationsSorter: 'alpha',
        tagsSorter: (a: string, b: string) => a.localeCompare(b),
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        deepLinking: true,
        defaultModelRendering: 'model',
        defaultModelsExpandDepth: 1,
      },
    }),
  );

  return router;
}
