export function splitColumns<T>(items: readonly T[]): [T[], T[]] {
  const left: T[] = [];
  const right: T[] = [];
  items.forEach((item, index) => (index % 2 === 0 ? left : right).push(item));
  return [left, right];
}
