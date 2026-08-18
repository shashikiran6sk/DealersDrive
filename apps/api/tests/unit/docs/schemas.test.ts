import { describe, expect, it } from 'vitest';

import { buildSchemaCatalogue } from '../../../src/docs/schemas.js';

/**
 * The documented schemas are generated from the same Zod contracts the API
 * parses with, so they cannot drift from the runtime by hand-editing. What
 * *can* drift is the input/output split.
 *
 * Zod's input and output types differ wherever a schema coerces or transforms:
 * `page` arrives as the string `"2"` and leaves as the number `2`. A request
 * body documented with output semantics tells a client to send a shape the API
 * would reject; a response documented with input semantics is a lie in the
 * other direction. `INPUT_SCHEMA_NAMES` is the list that decides, and it is
 * validated at build time — a name that contracts no longer exports throws
 * rather than silently generating nothing.
 */

const catalogue = buildSchemaCatalogue();

describe('buildSchemaCatalogue', () => {
  it('generates a substantial component set', () => {
    expect(Object.keys(catalogue.schemas).length).toBeGreaterThan(50);
  });

  it('names every schema after its contracts export', () => {
    for (const name of Object.keys(catalogue.schemas)) {
      expect(name).toMatch(/^[A-Z][A-Za-z0-9]*$/);
    }
  });

  it('gives every schema a type or a composition keyword', () => {
    for (const [name, schema] of Object.entries(catalogue.schemas)) {
      const keys = Object.keys(schema);
      expect(
        keys.some((key) => ['type', 'oneOf', 'anyOf', 'allOf', 'enum', '$ref'].includes(key)),
        name,
      ).toBe(true);
    }
  });

  it('is deterministic', () => {
    expect(JSON.stringify(buildSchemaCatalogue().schemas)).toBe(JSON.stringify(catalogue.schemas));
  });
});

describe('ref', () => {
  it('returns a $ref pointing into components.schemas', () => {
    const name = Object.keys(catalogue.schemas)[0] as string;

    expect(catalogue.ref(name)).toEqual({ $ref: `#/components/schemas/${name}` });
  });

  /**
   * A typo would otherwise produce a dangling `$ref` — an empty box in Swagger
   * UI and a broken client generator, discovered by whoever reads the docs
   * rather than by whoever wrote them.
   */
  it('throws for a name that is not a component', () => {
    expect(() => catalogue.ref('NoSuchSchema')).toThrow(
      'docs: no component schema named "NoSuchSchema"',
    );
  });
});

describe('resolved', () => {
  it('returns the generated schema itself, for splitting into parameters', () => {
    const name = Object.keys(catalogue.schemas)[0] as string;

    expect(catalogue.resolved(name)).toEqual(catalogue.schemas[name]);
  });

  it('returns an object schema for a query contract', () => {
    const resolved = catalogue.resolved('VehicleQuery');

    expect(resolved.type).toBe('object');
    expect(Object.keys(resolved.properties as Record<string, unknown>)).toContain('page');
  });
});

describe('the input/output split', () => {
  /**
   * `VehicleQuery` is the clearest case: `page` and `limit` arrive as strings
   * off a query string and leave as numbers. Documented with output semantics
   * they would read `type: integer`, and a client sending `?page=2` — the only
   * thing a query string *can* send — would appear to be violating the
   * contract it was handed.
   */
  it('documents a query contract with input semantics', () => {
    expect(catalogue.isInput('VehicleQuery')).toBe(true);
  });

  it('documents a response contract with output semantics', () => {
    expect(catalogue.isInput('VehicleCard')).toBe(false);
  });

  it('is false for a name that is not a component at all', () => {
    expect(catalogue.isInput('NoSuchSchema')).toBe(false);
  });

  /**
   * The visible payoff of input semantics: `?make=maruti-suzuki,hyundai` is a
   * comma-separated **string** on the wire and an array of slugs after
   * parsing. Documented from the output side it would read `type: array`, and
   * a generated client would try to send `make[]=…`, which this API rejects.
   */
  it('documents a CSV multi-select as the string a URL can actually carry', () => {
    const properties = catalogue.resolved('VehicleQuery').properties as Record<
      string,
      { type: string }
    >;

    expect(properties.make?.type).toBe('string');
    expect(properties.fuel?.type).toBe('string');
    expect(properties.owners?.type).toBe('string');
  });

  /** Two names, two semantics, one registry — they must not collide. */
  it('generates both groups into the same flat component map', () => {
    expect(catalogue.schemas).toHaveProperty('VehicleQuery');
    expect(catalogue.schemas).toHaveProperty('VehicleCard');
  });
});

describe('embedding', () => {
  /**
   * The reason both groups share a registry: a schema used inside another
   * becomes a `$ref` rather than being copied. Without it,
   * `VehicleListResponse` would inline the whole of `VehicleCard` and the
   * document would be unreadable.
   */
  it('references a nested schema rather than inlining it', () => {
    const listResponse = JSON.stringify(catalogue.schemas.VehicleListResponse);

    expect(listResponse).toContain('#/components/schemas/VehicleCard');
  });

  it('points every internal $ref at a schema that exists', () => {
    const refs = [...JSON.stringify(catalogue.schemas).matchAll(/#\/components\/schemas\/(\w+)/g)];

    for (const [, name] of refs) {
      expect(catalogue.schemas, name).toHaveProperty(name as string);
    }
  });
});

describe('what the generated schemas must not carry', () => {
  /**
   * CLAUDE.md: never expose internal database fields. These names would tell a
   * reader the shape of the tables, and a generated client would then expect
   * them.
   */
  it.each(['deletedAt', 'searchDoc', 'creditBalance_cache', 'internalNotes'])(
    'never documents %s',
    (field) => {
      expect(JSON.stringify(catalogue.schemas)).not.toContain(`"${field}"`);
    },
  );

  it('never documents a phone on a public vehicle card', () => {
    expect(JSON.stringify(catalogue.schemas.VehicleCard)).not.toMatch(/phone/i);
  });
});
