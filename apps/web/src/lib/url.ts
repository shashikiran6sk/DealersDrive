export type SearchParamsInput = Record<string, string | string[] | undefined>;

export function one(params: SearchParamsInput, key: string): string | undefined {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === '' ? undefined : value;
}

export function many(params: SearchParamsInput, key: string): string[] {
  return (one(params, key) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}
