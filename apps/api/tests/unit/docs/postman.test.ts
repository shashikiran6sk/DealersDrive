import { describe, expect, it } from 'vitest';

import {
  buildPostmanCollection,
  buildPostmanEnvironment,
  type PostmanCollection,
} from '../../../src/docs/postman.js';

/**
 * The collection is generated from the OpenAPI document, so most of it cannot
 * drift. What *can* is the hand-written part: the tables that decide which
 * request runs last, which one captures an id, and which non-2xx answers are
 * expected on a clean seed. `buildPostmanCollection` already throws when one of
 * those names an operation that no longer exists — these tests cover the other
 * half, that the wiring those tables produce actually holds together.
 *
 * The property that makes `Run all` work at all: **every `{{variable}}` a
 * request interpolates is either declared with a value or captured by a
 * request that runs before it.** A missing one produces a URL like
 * `/v1/dealer/listings//renew`, which 404s for a reason that has nothing to do
 * with the API.
 *
 * (The committed file's freshness is checked by `tests/postman.test.ts`, which
 * compares it to what this builder produces.)
 */

const collection = buildPostmanCollection();

interface Item {
  name: string;
  request: PostmanCollection['item'][number]['item'][number]['request'];
  event?: { listen: string; script: { exec: string[] } }[];
}

function items(): { folder: string; item: Item }[] {
  return collection.item.flatMap((folder) =>
    folder.item.map((item) => ({ folder: folder.name, item: item })),
  );
}

function urlOf(item: Item): string {
  return item.request.url.raw;
}

function scriptOf(item: Item): string {
  return (item.event ?? [])
    .filter((event) => event.listen === 'test')
    .flatMap((event) => event.script.exec)
    .join('\n');
}

const declared = new Set(collection.variable.map((variable) => variable.key));

describe('the collection', () => {
  it('is Postman Collection v2.1', () => {
    expect(collection.info.schema).toBe(
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    );
  });

  it('is named and versioned', () => {
    expect(collection.info.name).toBe('Dealers-Drive API');
    expect(collection.info.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('explains how to use it, not just what it contains', () => {
    expect(collection.info.description).toContain('pnpm db:seed');
  });

  it('groups every request into a folder', () => {
    expect(collection.item.length).toBeGreaterThan(5);
    for (const folder of collection.item) {
      expect(folder.item.length, folder.name).toBeGreaterThan(0);
    }
  });

  it('covers the whole API, not a subset', () => {
    expect(items().length).toBeGreaterThan(60);
  });

  /** The auth section is prose about the permission model, not endpoints. */
  it('has no folder for the conventions-only tag', () => {
    expect(collection.item.map((folder) => folder.name)).not.toContain(
      'Authentication & authorization',
    );
  });

  it('describes every folder', () => {
    for (const folder of collection.item) {
      expect(folder.description, folder.name).toBeTruthy();
    }
  });

  it('is deterministic', () => {
    expect(JSON.stringify(buildPostmanCollection())).toBe(JSON.stringify(collection));
  });
});

describe('requests', () => {
  it('names every request', () => {
    for (const { folder, item } of items()) {
      expect(item.name, folder).toBeTruthy();
    }
  });

  it('describes every request', () => {
    for (const { item } of items()) {
      expect(item.request.description, item.name).toBeTruthy();
    }
  });

  it('uses a real HTTP method', () => {
    for (const { item } of items()) {
      expect(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'], item.name).toContain(item.request.method);
    }
  });

  /**
   * Baking one developer's `API_BASE_URL` into a committed artifact is how a
   * portable collection stops being portable.
   */
  it('addresses everything through {{baseUrl}}', () => {
    for (const { item } of items()) {
      expect(urlOf(item), item.name).toContain('{{baseUrl}}');
      expect(urlOf(item), item.name).not.toContain('localhost:4000/v1');
    }
  });

  /**
   * `PUT /uploads` is the exception and stays one: it carries the image bytes,
   * and its Content-Type must equal the type that was *signed* for that
   * upload. A baked-in `application/json` there would make every presigned PUT
   * fail its signature check.
   */
  it('sends every JSON body with a JSON Content-Type', () => {
    for (const { item } of items()) {
      const body = item.request.body as { mode?: string; raw?: string } | undefined;
      if (body?.mode !== 'raw' || !body.raw?.trimStart().startsWith('{')) continue;

      const contentType = item.request.header.find(
        (header) => header.key.toLowerCase() === 'content-type',
      );
      expect(contentType?.value ?? '', item.name).toContain('json');
    }
  });

  it('leaves the presigned upload’s Content-Type to the caller', () => {
    const upload = items().find(({ item }) => urlOf(item).includes('/uploads?'));

    expect(upload).toBeDefined();
    expect(
      (upload?.item as Item).request.header.some(
        (header) => header.key.toLowerCase() === 'content-type',
      ),
    ).toBe(false);
  });

  it('never puts a body on a GET', () => {
    for (const { item } of items()) {
      if (item.request.method === 'GET') {
        expect(item.request.body, item.name).toBeUndefined();
      }
    }
  });

  /** `{id}` reaching a request means a path variable was never mapped. */
  it('leaves no OpenAPI path template unresolved', () => {
    for (const { item } of items()) {
      const withoutPostmanVariables = urlOf(item).replaceAll(/\{\{\w+\}\}/g, '');
      expect(withoutPostmanVariables, item.name).not.toMatch(/[{}]/);
    }
  });
});

describe('variables', () => {
  it('declares baseUrl with a working local default', () => {
    const baseUrl = collection.variable.find((variable) => variable.key === 'baseUrl');

    expect(baseUrl?.value).toBe('http://localhost:4000');
  });

  it('gives every declared variable a key', () => {
    for (const variable of collection.variable) {
      expect(variable.key).toBeTruthy();
    }
  });

  it('declares no variable twice', () => {
    const keys = collection.variable.map((variable) => variable.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  /**
   * The `Run all` invariant. A variable neither declared nor captured earlier
   * interpolates to the empty string, and `/v1/dealer/listings//renew` then
   * 404s for a reason that has nothing to do with the API — the exact bug this
   * check exists to prevent recurring.
   */
  it('resolves every {{variable}} from a declaration or an earlier capture', () => {
    const available = new Set(declared);
    const ordered = items();

    for (const { item } of ordered) {
      const used = [...urlOf(item).matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1] as string);

      for (const name of used) {
        expect(available, `${item.name} uses {{${name}}}`).toContain(name);
      }

      for (const [, captured] of scriptOf(item).matchAll(
        /pm\.(?:collection|environment)Variables\.set\(\s*['"](\w+)['"]/g,
      )) {
        available.add(captured as string);
      }
    }
  });

  it('captures at least one id, or nothing downstream could be addressed', () => {
    const captures = items().filter(({ item }) => /Variables\.set\(/.test(scriptOf(item)));

    expect(captures.length).toBeGreaterThan(0);
  });

  /**
   * A DELETE wired to the same `{{vehicleId}}` every other dealer request uses
   * would, on a `Run all`, destroy the draft the media and listing folders
   * still need. It is deliberately opt-in.
   */
  it('points the destructive delete at its own opt-in variable', () => {
    const remove = items().find(
      ({ item }) =>
        item.request.method === 'DELETE' && urlOf(item).includes('/v1/dealer/vehicles/'),
    );

    expect(remove).toBeDefined();
    expect(urlOf(remove?.item as Item)).toContain('{{disposableVehicleId}}');
    expect(urlOf(remove?.item as Item)).not.toContain('{{vehicleId}}');
  });

  /** A different dealership from the one the session resolves to. */
  it('addresses the public dealer portfolio by slug, not by the session dealer', () => {
    const portfolio = items().find(({ item }) => urlOf(item).includes('/v1/dealers/{{'));

    expect(urlOf(portfolio?.item as Item)).toContain('{{dealerSlug}}');
  });
});

describe('test scripts', () => {
  it('runs a collection-level test on every request', () => {
    const collectionTests = collection.event.filter((event) => event.listen === 'test');

    expect(collectionTests).toHaveLength(1);
    expect(collectionTests[0]?.script.exec.join('\n')).toContain('pm.test');
  });

  /** Every failure is a problem document; the shared script is where that is enforced. */
  it('asserts the problem+json shape on failures', () => {
    const script = collection.event[0]?.script.exec.join('\n') ?? '';

    expect(script).toContain('problem+json');
    expect(script).toContain('traceId');
  });

  it('writes only valid JavaScript-looking script lines', () => {
    for (const { item } of items()) {
      const script = scriptOf(item);
      if (script) expect(script).not.toContain('undefined(');
    }
  });
});

describe('the environment file', () => {
  it('mirrors the collection variables exactly', () => {
    const environment = buildPostmanEnvironment() as {
      values: { key: string; value: string; enabled: boolean }[];
    };

    expect(environment.values.map((value) => value.key)).toEqual(
      collection.variable.map((variable) => variable.key),
    );
  });

  it('enables every value, so importing it is enough', () => {
    const environment = buildPostmanEnvironment() as { values: { enabled: boolean }[] };

    expect(environment.values.every((value) => value.enabled)).toBe(true);
  });

  it('is scoped as an environment, so baseUrl can be switched without editing the collection', () => {
    expect(buildPostmanEnvironment()._postman_variable_scope).toBe('environment');
  });

  it('is named for the local setup it configures', () => {
    expect(buildPostmanEnvironment().name).toBe('Dealers-Drive — local');
  });
});
