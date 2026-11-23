import { TAMIL_FUEL, TAMIL_KM, TAMIL_TRANSMISSION } from '../copy/tamil';
import type { Bilingual } from '../reel/reel.types';

const KM_PATTERN = /^([\d,]+)\s*km$/i;
const META_SEPARATOR = '·';

function specFrom(part: string): Bilingual | null {
  const km = KM_PATTERN.exec(part);
  if (km?.[1] !== undefined) return { en: `${km[1]} km`, ta: `${km[1]} ${TAMIL_KM}` };

  const key = part.toLowerCase();
  const ta = TAMIL_FUEL[key] ?? TAMIL_TRANSMISSION[key];
  return ta === undefined ? null : { en: part, ta };
}

export function carSpecs(metaLabel: string): Bilingual[] {
  return metaLabel
    .split(META_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(specFrom)
    .filter((spec): spec is Bilingual => spec !== null);
}

export function titleWithoutYear(title: string, year: number | null): string {
  if (year === null) return title.trim();
  const prefix = `${year} `;
  return title.startsWith(prefix) ? title.slice(prefix.length).trim() : title.trim();
}
