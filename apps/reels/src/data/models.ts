export type ModelName = {
  brand: string;
  model: string;
};

export function words(text: string): string[] {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => word.length > 0);
}

function startsWithWords(haystack: readonly string[], needle: readonly string[]): boolean {
  return needle.length > 0 && needle.every((word, index) => haystack[index] === word);
}

export function modelKey(title: string, models: readonly ModelName[]): string {
  const titleWords = words(title);
  let best: string[] = [];
  for (const { brand, model } of models) {
    const name = [...words(brand), ...words(model)];
    if (name.length > best.length && startsWithWords(titleWords, name)) best = name;
  }
  return (best.length > 0 ? best : titleWords).join(' ');
}

export function matchesTerm(title: string, term: string): boolean {
  const target = words(term).join('');
  if (target.length === 0) return false;
  const titleWords = words(title);
  return titleWords.some((_, index) => titleWords.slice(index).join('').startsWith(target));
}
