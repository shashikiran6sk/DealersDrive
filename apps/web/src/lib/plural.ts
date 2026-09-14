/** The noun for a count: "district" at one, "districts" otherwise. */
export function pluralLabel(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/** The count and its noun — "1 district", "4 districts". */
export function countLabel(count: number, singular: string, plural?: string): string {
  return `${String(count)} ${pluralLabel(count, singular, plural)}`;
}
