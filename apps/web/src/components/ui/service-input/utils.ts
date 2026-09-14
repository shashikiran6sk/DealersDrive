export function splitServiceEntries(raw: string): string[] {
  return raw
    .split(',')
    .map((entry) => entry.trim().replace(/\s+/g, ' '))
    .filter((entry) => entry.length > 0);
}

export function containsService(services: readonly string[], entry: string): boolean {
  return services.some((existing) => existing.toLowerCase() === entry.toLowerCase());
}
