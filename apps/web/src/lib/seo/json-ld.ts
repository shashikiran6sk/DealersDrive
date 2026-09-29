export type JsonLdValue =
  string | number | boolean | null | undefined | readonly JsonLdValue[] | JsonLdNode;

export interface JsonLdNode {
  readonly [key: string]: JsonLdValue;
}

export interface JsonLdDocument extends JsonLdNode {
  '@context': string;
}

const UNSAFE_IN_SCRIPT = /[<>&\u2028\u2029]/g;

function escapeForScript(character: string): string {
  return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`;
}

export function serializeJsonLd(document: JsonLdDocument): string {
  return JSON.stringify(document).replace(UNSAFE_IN_SCRIPT, escapeForScript);
}
