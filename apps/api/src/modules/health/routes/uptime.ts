export const startedAt = Date.now();

export async function probe(check: () => Promise<unknown>): Promise<string> {
  try {
    await check();
    return 'ok';
  } catch {
    return 'down';
  }
}
