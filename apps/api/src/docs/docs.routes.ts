import { Router } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { stringify } from 'yaml';

import { buildOpenApiDocument } from './openapi.js';

/**
 * Swagger UI and the raw document.
 *
 *   GET /api/docs               the UI
 *   GET /api/docs/openapi.json  the document
 *   GET /api/docs/openapi.yaml  the same document, as YAML
 *
 * Mounted outside `/v1`, like `/health`: the reference is not itself versioned
 * API surface, and a client should not have to bump a version prefix to read the
 * docs for the version it is already on.
 *
 * The document is built **once** at startup rather than per request. It is
 * derived entirely from code — the contracts schemas and the per-module
 * operation lists — so nothing about it can change while the process runs, and
 * converting ~140 Zod schemas on every page load would be waste.
 */
export function createDocsRouter(): Router {
  const router = Router();
  const document = buildOpenApiDocument();

  /**
   * Swagger UI needs a looser policy than the JSON API.
   *
   * The app-wide `helmet()` sets `script-src 'self'`, and swagger-ui-express
   * bootstraps itself with an inline `<script>`. Rather than weaken the policy
   * for the whole API, this replaces it on this route only — the JSON endpoints
   * keep the strict default. Everything is still same-origin: the UI's assets
   * are served by this process, not from a CDN.
   */
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
      /**
       * Swagger UI renders markdown tables without borders, which turns the
       * permission matrix and the credit-lifecycle table into loosely aligned
       * columns. Three rules, no theming: the tables are load-bearing
       * documentation, not decoration.
       */
      customCss: `
        .swagger-ui .renderedMarkdown table { border-collapse: collapse; margin: 12px 0; }
        .swagger-ui .renderedMarkdown table th,
        .swagger-ui .renderedMarkdown table td { border: 1px solid #d3dce6; padding: 5px 10px; }
        .swagger-ui .renderedMarkdown table th { background: #f0f4f8; text-align: left; }
      `,
      swaggerOptions: {
        // Collapsed: 73 operations expanded is a wall, and the tag descriptions
        // are where the conventions are explained.
        docExpansion: 'none',
        // Alphabetical within a tag, so an endpoint is findable without reading
        // the whole group.
        operationsSorter: 'alpha',
        tagsSorter: (a: string, b: string) => a.localeCompare(b),
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        // So a link to one endpoint is a link to one endpoint — a code review
        // that says "see POST /listings/{id}/approve" can point at it.
        deepLinking: true,
        // The schema tab is more useful than the generated example for reading
        // a contract; the example is one click away either way.
        defaultModelRendering: 'model',
        defaultModelsExpandDepth: 1,
      },
    }),
  );

  return router;
}
