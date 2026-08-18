import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../src/docs/openapi.js';
import {
  COLLECTION_PATH,
  ENVIRONMENT_PATH,
  repoRoot,
  serialise,
} from '../src/docs/generate-postman.js';
import { buildPostmanCollection, buildPostmanEnvironment } from '../src/docs/postman.js';

/**
 * The Postman collection is a **committed generated artifact** — a tester should
 * be able to import it without running a build step. That convenience is also
 * its failure mode: a committed file drifts the moment a route changes and
 * nobody regenerates it.
 *
 * So this test does the only thing that keeps such a file honest: it regenerates
 * the collection and compares it to what is on disk. Add an endpoint, forget
 * `pnpm docs:postman`, and the suite tells you.
 */

interface PostmanRequestItem {
  name: string;
  request: {
    method: string;
    url: { raw: string; path: string[]; query?: { key: string; disabled?: boolean }[] };
    body?: { mode: string; raw?: string };
    description: string;
    header: { key: string }[];
  };
  event?: { listen: string; script: { exec: string[] } }[];
}

interface PostmanCollectionFile {
  info: { name: string; schema: string; description: string };
  variable: { key: string; value: string }[];
  item: { name: string; item: PostmanRequestItem[] }[];
  event: { listen: string; script: { exec: string[] } }[];
}

const collection = buildPostmanCollection() as unknown as PostmanCollectionFile;
const requests = collection.item.flatMap((folder) => folder.item);

const document = buildOpenApiDocument() as unknown as {
  paths: Record<string, Record<string, unknown>>;
};
const operationCount = Object.values(document.paths).reduce(
  (total, methods) => total + Object.keys(methods).length,
  0,
);

describe('the Postman collection', () => {
  it('is committed in sync with the OpenAPI document', async () => {
    const onDisk = await readFile(resolve(repoRoot(), COLLECTION_PATH), 'utf8');

    expect(
      onDisk === serialise(collection),
      `${COLLECTION_PATH} is stale — run \`pnpm docs:postman\` in apps/api`,
    ).toBe(true);

    const environment = await readFile(resolve(repoRoot(), ENVIRONMENT_PATH), 'utf8');
    expect(
      environment === serialise(buildPostmanEnvironment()),
      `${ENVIRONMENT_PATH} is stale — run \`pnpm docs:postman\` in apps/api`,
    ).toBe(true);
  });

  it('declares itself as Collection v2.1 so Postman imports it', () => {
    expect(collection.info.schema).toBe(
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    );
    expect(collection.info.name).toBe('Dealers-Drive API');
  });

  it('carries one request per documented operation', () => {
    expect(requests).toHaveLength(operationCount);
  });

  it('resolves every path variable to a declared collection variable', () => {
    const declared = new Set(collection.variable.map((variable) => variable.key));

    for (const request of requests) {
      // Nothing may reach Postman still holding an OpenAPI placeholder: `{id}`
      // in a URL would be sent literally and 400 on the uuid check. Postman's
      // own `{{var}}` syntax is stripped first, since it shares the brace.
      const withoutVariables = request.request.url.raw.replaceAll(/\{\{[^}]+\}\}/g, '');
      expect(withoutVariables, `${request.name} has an unsubstituted {param}`).not.toContain('{');

      for (const [, name] of request.request.url.raw.matchAll(/\{\{([^}]+)\}\}/g)) {
        expect(declared, `${request.name} uses undeclared {{${name ?? ''}}}`).toContain(name);
      }
    }
  });

  it('points the dealer and admin endpoints at semantically correct variables', () => {
    // Keyed by method *and* url: GET, PATCH and DELETE all share
    // `/v1/dealer/vehicles/{{vehicleId}}`, so a url-only key would keep one.
    const byRoute = new Map(
      requests.map((request) => [`${request.request.method} ${request.request.url.raw}`, request]),
    );

    // The distinction that makes this collection worth generating: `{id}` means
    // eight different things, and a shared `{{id}}` would send a listing id to a
    // vehicle endpoint.
    const expected: [string, string][] = [
      ['{{baseUrl}}/v1/dealer/vehicles/{{vehicleId}}', 'GET'],
      ['{{baseUrl}}/v1/dealer/vehicles/{{vehicleId}}/submit', 'POST'],
      ['{{baseUrl}}/v1/admin/listings/{{listingId}}/approve', 'POST'],
      ['{{baseUrl}}/v1/admin/dealers/{{dealerId}}/suspend', 'POST'],
      ['{{baseUrl}}/v1/dealer/billing/orders/{{orderId}}/verify', 'POST'],
      ['{{baseUrl}}/v1/dealer/billing/invoices/{{invoiceId}}/pdf', 'GET'],
      ['{{baseUrl}}/v1/dealer/documents/{{documentType}}', 'DELETE'],
      ['{{baseUrl}}/v1/vehicles/{{vehicleSlug}}', 'GET'],
      ['{{baseUrl}}/v1/vehicles/{{publicVehicleId}}/reveal-contact', 'POST'],
      ['{{baseUrl}}/v1/dealers/{{dealerSlug}}', 'GET'],
      ['{{baseUrl}}/v1/admin/config/{{configKey}}', 'PUT'],
    ];

    for (const [raw, method] of expected) {
      expect(byRoute.has(`${method} ${raw}`), `no ${method} ${raw} in the collection`).toBe(true);
    }
  });

  it('pre-fills a JSON body for every write that takes one', () => {
    const withBody = requests.filter((request) => request.request.body?.mode === 'raw');
    expect(withBody.length).toBeGreaterThan(20);

    for (const request of withBody) {
      const raw = request.request.body?.raw ?? '';
      // Parsing it is the assertion: an example that is not valid JSON is worse
      // than no example, because Postman will send it.
      expect(
        () => JSON.parse(raw) as unknown,
        `${request.name} body is not valid JSON`,
      ).not.toThrow();
      expect(request.request.header.map((header) => header.key)).toContain('Content-Type');
    }
  });

  it('disables optional query parameters', () => {
    const search = requests.find((request) => request.name === 'Search and filter the catalogue');
    const query = search?.request.url.query ?? [];

    expect(query.length).toBeGreaterThan(15);
    // `.strict()` means an empty `?q=` is a filter for the empty string, not the
    // absence of one — so nothing optional may be enabled by default.
    for (const parameter of query) {
      expect(parameter.disabled, `${parameter.key} should be disabled`).toBe(true);
    }
  });

  it('captures the ids a flow needs, into the variables it declares', () => {
    const declared = new Set(collection.variable.map((variable) => variable.key));
    const withCaptures = requests.filter((request) =>
      request.event?.some((event) => event.listen === 'test'),
    );

    expect(withCaptures.length).toBeGreaterThan(10);

    for (const request of withCaptures) {
      const source = request.event?.[0]?.script.exec.join('\n') ?? '';
      for (const [, name] of source.matchAll(/collectionVariables\.set\('([^']+)'/g)) {
        expect(declared, `${request.name} captures into undeclared ${name ?? ''}`).toContain(name);
      }
    }
  });

  it('asserts the error contract on every request', () => {
    const script = collection.event.find((event) => event.listen === 'test');
    const source = script?.script.exec.join('\n') ?? '';

    expect(source).toContain('application/problem+json');
    expect(source).toContain("to.have.property('code')");
    expect(source).toContain("to.have.property('traceId')");
    expect(source).toContain("to.not.have.property(\n      'stack',");
  });

  it('does not bake a developer environment into a portable artifact', () => {
    const baseUrl = collection.variable.find((variable) => variable.key === 'baseUrl');
    expect(baseUrl?.value).toBe('http://localhost:4000');

    // No absolute host anywhere except through {{baseUrl}}.
    for (const request of requests) {
      expect(request.request.url.raw.startsWith('{{baseUrl}}'), request.name).toBe(true);
    }
  });
});
