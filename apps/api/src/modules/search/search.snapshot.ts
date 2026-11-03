export type Snapshot<T> = (fingerprint: string) => Promise<T>;

export function snapshotOf<T>(load: () => Promise<T>): Snapshot<T> {
  let held: { fingerprint: string; value: Promise<T> } | null = null;

  return (fingerprint) => {
    if (held?.fingerprint === fingerprint) return held.value;
    const entry = { fingerprint, value: load() };
    held = entry;
    entry.value.catch(() => {
      if (held === entry) held = null;
    });
    return entry.value;
  };
}
