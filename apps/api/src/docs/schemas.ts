import * as contracts from '@dealers-drive/contracts';
import { z } from 'zod';

/**
 * `components.schemas`, generated from `@dealers-drive/contracts`.
 *
 * The contracts package is already the single source of truth for every shape
 * that crosses the wire — the API validates with it and the web app parses with
 * it. Converting those same Zod schemas is therefore the only way the reference
 * can be *wrong the same way the code is wrong*, which is the only kind of
 * documentation worth having. Nothing here is transcribed by hand, so a renamed
 * field cannot drift out of the docs.
 *
 * Two conversions, not one:
 *
 *   `io: 'input'`   for request bodies, query strings and path params. This is
 *                   the pre-parse shape: `.default()` fields are optional, and
 *                   `z.coerce.number()` still accepts the string a query string
 *                   actually carries.
 *   `io: 'output'`  for responses. Post-parse: defaults are filled in and
 *                   therefore required.
 *
 * Getting that backwards would document `?limit=` as a required integer and
 * `page.limit` as an optional one — exactly inverted.
 */

/** A JSON Schema object as OpenAPI 3.0 accepts it. */
export type JsonSchema = Record<string, unknown>;

type ZodSchema = z.ZodType;

const SCHEMA_REF_PREFIX = '#/components/schemas/';

/**
 * The schemas used as request input, by export name.
 *
 * Kept explicit rather than inferred from a name pattern: the split decides
 * whether `limit` reads as required, and a silent misclassification is worse
 * than a list that has to be extended when a new input schema appears. The
 * builder throws if an operation references an input schema that is missing
 * from this list, so it cannot fall out of date unnoticed.
 */
const INPUT_SCHEMA_NAMES = [
  // params
  'IdParam',
  'SlugParam',
  'IdOrSlugParam',
  // query
  'CursorQuery',
  // bodies
  'OnboardingInput',
  'AdminLoginInput',
  'MediaPresignInput',
  'MediaCommitInput',
  /*
   * ── Reconstruction slice ──────────────────────────────────────────────
   * The baseline lists 42 names. The other 34 are exported by contracts
   * modules that have not landed yet — `DocTypeParam` and `DocumentPresignInput`
   * with F041, `VehicleQuery` and `CreateVehicleInput` with F055/F060,
   * `ReorderMediaInput` with F035, the admin and billing bodies with tiers 8
   * and 11. `buildSchemaCatalogue()` throws when a name here is not exported,
   * so this list cannot silently run ahead of contracts: add the name in the
   * same PR that adds the schema.
   */
] as const;

export type InputSchemaName = (typeof INPUT_SCHEMA_NAMES)[number];

interface Catalogued {
  name: string;
  schema: ZodSchema;
}

/** Every Zod schema the contracts package exports, with its export name. */
function catalogue(): Catalogued[] {
  return Object.entries(contracts as Record<string, unknown>)
    .filter((entry): entry is [string, ZodSchema] => isZodSchema(entry[1]))
    .map(([name, schema]) => ({ name, schema }));
}

function isZodSchema(value: unknown): value is ZodSchema {
  return typeof value === 'object' && value !== null && '_zod' in value;
}

/** The Zod internals needed to tell an object/enum apart from a bare string. */
function typeOf(schema: ZodSchema): string {
  return (schema as unknown as { _zod: { def: { type: string } } })._zod.def.type;
}

/**
 * `Uuid` is a bare `z.string().uuid()`. Promoting scalars to components would
 * turn every id field into a `$ref` and make the reference harder to read, not
 * easier — so only objects and enums become named components. Enums earn their
 * place: `FuelType` and `ListingStatus` are the vocabulary the whole API shares.
 */
function isComponentWorthy(schema: ZodSchema): boolean {
  const type = typeOf(schema);
  return type === 'object' || type === 'enum';
}

/**
 * Strips the noise Zod's converter leaves behind.
 *
 *   `$id`                     OpenAPI 3.0 addresses components by path, and a
 *                             stray `$id` makes Swagger UI's model view show a
 *                             second, redundant name.
 *   safe-integer min/max      `z.number().int()` with no bounds emits
 *                             ±9007199254740991. That is JavaScript's limit,
 *                             not the API's, and printing it on ~200 fields
 *                             implies a constraint nobody wrote.
 */
const JS_SAFE_INT = 9_007_199_254_740_991;

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean);
  if (typeof node !== 'object' || node === null) return node;

  const source = node as JsonSchema;
  const out: JsonSchema = {};

  for (const [key, value] of Object.entries(source)) {
    if (key === '$id') continue;
    if (key === 'minimum' && value === -JS_SAFE_INT) continue;
    if (key === 'maximum' && value === JS_SAFE_INT) continue;
    out[key] = clean(value);
  }

  return out;
}

export interface SchemaCatalogue {
  /** Ready for `components.schemas`. */
  schemas: Record<string, JsonSchema>;
  /** `$ref` for a contracts export, by name. Throws if it is not a component. */
  ref(name: string): JsonSchema;
  /** The generated schema for a params/query object, for splitting into parameters. */
  resolved(name: string): JsonSchema;
  /** True when the name was generated with input (pre-parse) semantics. */
  isInput(name: string): boolean;
}

export function buildSchemaCatalogue(): SchemaCatalogue {
  const all = catalogue().filter((entry) => isComponentWorthy(entry.schema));
  const inputNames = new Set<string>(INPUT_SCHEMA_NAMES);

  const missing = [...inputNames].filter((name) => !all.some((entry) => entry.name === name));
  if (missing.length > 0) {
    throw new Error(
      `docs: INPUT_SCHEMA_NAMES lists schemas that @dealers-drive/contracts no longer exports: ${missing.join(', ')}`,
    );
  }

  const schemas: Record<string, JsonSchema> = {};

  for (const io of ['input', 'output'] as const) {
    const group = all.filter((entry) => inputNames.has(entry.name) === (io === 'input'));

    // One call per group, sharing a registry, so a schema embedded in another
    // becomes a `$ref` instead of being copied. That is what keeps the document
    // readable: `VehicleListResponse.data` points at `VehicleCard`, once.
    const registry = z.registry<{ id: string }>();
    for (const entry of group) registry.add(entry.schema, { id: entry.name });

    const converted = z.toJSONSchema(registry, {
      target: 'openapi-3.0',
      io,
      uri: (id) => `${SCHEMA_REF_PREFIX}${id}`,
    });

    for (const [name, schema] of Object.entries(converted.schemas)) {
      schemas[name] = clean(schema) as JsonSchema;
    }
  }

  return {
    schemas,
    ref(name) {
      if (!(name in schemas)) {
        throw new Error(`docs: no component schema named "${name}" — check the contracts export.`);
      }
      return { $ref: `${SCHEMA_REF_PREFIX}${name}` };
    },
    resolved(name) {
      const schema = schemas[name];
      if (!schema) {
        throw new Error(`docs: no component schema named "${name}".`);
      }
      return schema;
    },
    isInput: (name) => inputNames.has(name),
  };
}
