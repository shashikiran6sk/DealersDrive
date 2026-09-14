import * as contracts from '@dealers-drive/contracts';
import { z } from 'zod';

export type JsonSchema = Record<string, unknown>;

type ZodSchema = z.ZodType;

const SCHEMA_REF_PREFIX = '#/components/schemas/';

const INPUT_SCHEMA_NAMES = [
  'IdParam',
  'SlugParam',
  'IdOrSlugParam',
  'DocTypeParam',
  'CursorQuery',
  'AdminDealerQuery',
  'DealerDirectoryQuery',
  'DealerSuggestQuery',
  'OnboardingInput',
  'MediaPresignInput',
  'MediaCommitInput',
  'DocumentPresignInput',
  'DocumentCommitInput',
  'YardPhotoPresignInput',
  'YardPhotoCommitInput',
  'UpdateDealerInput',
  'DealerSelfUpdateInput',
  'ReasonInput',
  'ApproveDealerInput',
  'NoteInput',
  'ConfigKeyParam',
  'UpdateConfigInput',
  'GrantAdminAccessInput',
  'PhoneAvailabilityInput',
  'VerifyPhoneInput',
] as const;

export type InputSchemaName = (typeof INPUT_SCHEMA_NAMES)[number];

interface Catalogued {
  name: string;
  schema: ZodSchema;
}

function catalogue(): Catalogued[] {
  return Object.entries(contracts as Record<string, unknown>)
    .filter((entry): entry is [string, ZodSchema] => isZodSchema(entry[1]))
    .map(([name, schema]) => ({ name, schema }));
}

function isZodSchema(value: unknown): value is ZodSchema {
  return typeof value === 'object' && value !== null && '_zod' in value;
}

function typeOf(schema: ZodSchema): string {
  return (schema as unknown as { _zod: { def: { type: string } } })._zod.def.type;
}

function isComponentWorthy(schema: ZodSchema): boolean {
  const type = typeOf(schema);
  return type === 'object' || type === 'enum';
}

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
  schemas: Record<string, JsonSchema>;
  ref(name: string): JsonSchema;
  resolved(name: string): JsonSchema;
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
