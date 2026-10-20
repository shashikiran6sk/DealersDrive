export function distinctServices(services: readonly string[]): string[] {
  const seen = new Set<string>();
  const shown: string[] = [];
  for (const service of services) {
    const text = service.trim();
    const key = text.toLocaleLowerCase('en-IN');
    if (!text || seen.has(key)) continue;
    seen.add(key);
    shown.push(text);
  }
  return shown;
}
