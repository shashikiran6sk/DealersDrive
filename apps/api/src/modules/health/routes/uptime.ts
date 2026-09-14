export const startedAt = Date.now();

/** Runs one dependency probe and reduces it to `ok` / `down`. */
export async function probe(check: () => Promise<unknown>): Promise<string> {
  try {
    await check();
    return 'ok';
  } catch {
    return 'down';
  }
}
