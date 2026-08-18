import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { createDocsRouter } from '../../../src/docs/docs.routes.js';

/**
 * Swagger UI and the raw document, mounted at `/api/docs` — outside `/v1`,
 * because the reference is not itself versioned API surface.
 *
 * The detail worth pinning is the CSP. The app-wide `helmet()` sets
 * `script-src 'self'`, and swagger-ui-express bootstraps itself with an inline
 * `<script>`, so the UI needs `'unsafe-inline'`. That relaxation is applied on
 * *this router only*: weakening the policy app-wide to make one HTML page work
 * would be the wrong trade, and it is the kind of change that gets made once
 * and never noticed again.
 *
 * The document is also built once at construction rather than per request —
 * converting ~140 Zod schemas on every page load would be waste, and nothing
 * about it can change while the process runs.
 */

function app(): Express {
  const instance = express();
  instance.use('/api/docs', createDocsRouter());
  return instance;
}

describe('the raw document', () => {
  it('serves JSON at /openapi.json', async () => {
    const response = await request(app()).get('/api/docs/openapi.json');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
  });

  it('serves a parseable OpenAPI document', async () => {
    const response = await request(app()).get('/api/docs/openapi.json');
    const document = JSON.parse(response.text) as { openapi: string; paths: object };

    expect(document.openapi).toMatch(/^3\.0\./);
    expect(Object.keys(document.paths).length).toBeGreaterThan(50);
  });

  it('serves the same document as YAML', async () => {
    const json = await request(app()).get('/api/docs/openapi.json');
    const yaml = await request(app()).get('/api/docs/openapi.yaml');

    expect(yaml.status).toBe(200);
    expect(yaml.headers['content-type']).toContain('yaml');
    expect(parse(yaml.text)).toEqual(JSON.parse(json.text));
  });

  /** Pretty-printed: this file gets read in a browser tab and pasted into issues. */
  it('indents the JSON rather than serving one long line', async () => {
    const response = await request(app()).get('/api/docs/openapi.json');

    expect(response.text).toContain('\n  ');
  });

  /** Built once at construction — the same bytes every time, at no extra cost. */
  it('serves identical bytes on repeated requests', async () => {
    const instance = app();
    const one = await request(instance).get('/api/docs/openapi.json');
    const two = await request(instance).get('/api/docs/openapi.json');

    expect(one.text).toBe(two.text);
  });
});

describe('the UI', () => {
  it('serves an HTML page at the mount root', async () => {
    const response = await request(app()).get('/api/docs/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
  });

  it('is Swagger UI, titled for this API', async () => {
    const response = await request(app()).get('/api/docs/');

    expect(response.text).toContain('Dealers-Drive API');
    expect(response.text).toContain('swagger');
  });

  /**
   * The tables are load-bearing documentation — the permission matrix and the
   * credit lifecycle — and Swagger UI renders markdown tables without borders,
   * which turns them into loosely aligned columns.
   */
  it('borders the markdown tables it renders', async () => {
    const response = await request(app()).get('/api/docs/');

    expect(response.text).toContain('renderedMarkdown table');
  });
});

describe('the content security policy', () => {
  it('allows the inline bootstrap script the UI needs', async () => {
    const response = await request(app()).get('/api/docs/');
    const csp = response.headers['content-security-policy'] ?? '';

    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  });

  /**
   * Relaxed for scripts and styles only. Everything else stays same-origin:
   * the UI's assets are served by this process, not from a CDN, so there is no
   * reason to allow one.
   */
  it('keeps everything else same-origin', async () => {
    const response = await request(app()).get('/api/docs/');
    const csp = response.headers['content-security-policy'] ?? '';

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('cdn.');
    expect(csp).not.toContain('*');
  });

  it('allows data: images, which the UI inlines', async () => {
    const response = await request(app()).get('/api/docs/');

    expect(response.headers['content-security-policy'] ?? '').toContain("img-src 'self' data:");
  });

  /**
   * The relaxation belongs to this router. If it ever leaked to the app-wide
   * policy, every JSON endpoint would start permitting inline scripts too.
   */
  it('applies the relaxed policy only under the docs mount', async () => {
    const instance = express();
    instance.use('/api/docs', createDocsRouter());
    instance.get('/v1/vehicles', (_req, res) => {
      res.json({ data: [] });
    });

    const api = await request(instance).get('/v1/vehicles');

    expect(api.headers['content-security-policy']).toBeUndefined();
  });
});
