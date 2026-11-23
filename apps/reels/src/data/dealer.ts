import { SERVICE_TRANSLATIONS, TAMIL_PLACES } from '../copy/tamil';
import type { Bilingual } from '../reel/reel.types';

function placeKey(place: string): string {
  return place.trim().toLowerCase();
}

export function dealerLocation(city: string, state: string): Bilingual {
  const en = [city.trim(), state.trim()].filter((part) => part.length > 0).join(', ');
  const taCity = TAMIL_PLACES[placeKey(city)];
  const taState = TAMIL_PLACES[placeKey(state)];
  return { en, ta: taCity !== undefined && taState !== undefined ? `${taCity}, ${taState}` : null };
}

export function serviceLabel(raw: string): Bilingual {
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  const match = SERVICE_TRANSLATIONS.find((translation) => key.includes(translation.match));
  if (match !== undefined) return { en: match.en, ta: match.ta };
  return { en: raw.trim().replace(/\s+/g, ' '), ta: null };
}

export function dealerServices(raw: readonly string[], max: number): Bilingual[] {
  const seen = new Set<string>();
  const services: Bilingual[] = [];
  for (const entry of raw) {
    if (entry.trim().length === 0) continue;
    const label = serviceLabel(entry);
    const key = label.en.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    services.push(label);
  }
  return services.slice(0, max);
}
