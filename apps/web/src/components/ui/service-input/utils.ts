/**
 * Splits what was typed or pasted into candidate services. Splitting on paste is
 * not a convenience — it is the reason a dealer who copies their service list
 * out of WhatsApp does not end up with one chip sixty characters long.
 */
export function splitServiceEntries(raw: string): string[] {
  return raw
    .split(',')
    .map((entry) => entry.trim().replace(/\s+/g, ' '))
    .filter((entry) => entry.length > 0);
}

/** "RC transfer" and "RC Transfer" are one service, and a buyer should not see both. */
export function containsService(services: readonly string[], entry: string): boolean {
  return services.some((existing) => existing.toLowerCase() === entry.toLowerCase());
}
