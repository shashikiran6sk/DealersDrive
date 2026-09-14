import { isGoogleMapsUrl } from '@dealers-drive/contracts';

import { logger } from '../telemetry/logger.js';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapsPlace {
  coordinates: LatLng | null;
  placeId: string | null;
}

export const NO_PLACE: MapsPlace = { coordinates: null, placeId: null };

export interface MapsPort {
  placeFor(mapsUrl: string): Promise<MapsPlace>;
}

export function createMapsResolver(fetchImpl: typeof fetch = fetch): MapsPort {
  return { placeFor: (mapsUrl) => resolvePlace(mapsUrl, fetchImpl) };
}

export const noMapsLookup: MapsPort = { placeFor: () => Promise.resolve(NO_PLACE) };

const MAX_REDIRECTS = 5;

const TIMEOUT_MS = 2500;

const PIN = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;
const CENTRE = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const EMBED_PIN = /!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/;
const PAIR = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;
const QUERY_KEYS = ['q', 'query', 'll', 'center', 'destination'];

function toLatLng(lat: string, lng: string): LatLng | null {
  const parsed = { lat: Number(lat), lng: Number(lng) };
  if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng)) return null;
  if (Math.abs(parsed.lat) > 90 || Math.abs(parsed.lng) > 180) return null;
  if (parsed.lat === 0 && parsed.lng === 0) return null;
  return parsed;
}

export function coordinatesIn(value: string): LatLng | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const pin = PIN.exec(url.href);
  if (pin?.[1] && pin[2]) {
    const found = toLatLng(pin[1], pin[2]);
    if (found) return found;
  }

  const centre = CENTRE.exec(url.pathname);
  if (centre?.[1] && centre[2]) {
    const found = toLatLng(centre[1], centre[2]);
    if (found) return found;
  }

  for (const key of QUERY_KEYS) {
    const pair = PAIR.exec(url.searchParams.get(key) ?? '');
    if (pair?.[1] && pair[2]) {
      const found = toLatLng(pair[1], pair[2]);
      if (found) return found;
    }
  }

  const embed = EMBED_PIN.exec(url.href);
  if (embed?.[1] && embed[2]) {
    const found = toLatLng(embed[2], embed[1]);
    if (found) return found;
  }

  return null;
}

const PLACE_ID = /!1s(0x[0-9a-f]+)(?::|%3A)(0x[0-9a-f]+)/i;
const FTID = /^(0x[0-9a-f]+):(0x[0-9a-f]+)$/i;

export function placeIdIn(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const explicit = FTID.exec(url.searchParams.get('ftid') ?? '');
  if (explicit?.[1] && explicit[2]) return identity(explicit[1], explicit[2]);

  const embedded = PLACE_ID.exec(url.href);
  if (embedded?.[1] && embedded[2]) return identity(embedded[1], embedded[2]);

  return null;
}

function identity(feature: string, cid: string): string | null {
  const id = `${feature.toLowerCase()}:${cid.toLowerCase()}`;
  return id === '0x0:0x0' ? null : id;
}

export async function resolvePlace(
  mapsUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MapsPlace> {
  let placeId = placeIdIn(mapsUrl);

  const direct = coordinatesIn(mapsUrl);
  if (direct) return { coordinates: direct, placeId };

  if (!isGoogleMapsUrl(mapsUrl)) return { ...NO_PLACE, placeId };

  let target = mapsUrl;

  try {
    for (let hop = 0; hop < MAX_REDIRECTS; hop += 1) {
      const response = await fetchImpl(target, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': 'Dealers-Drive/1.0 (+https://dealers-drive.com)',
        },
      });

      const next = response.headers.get('location');
      if (next === null) {
        return {
          coordinates: coordinatesIn(response.url),
          placeId: placeIdIn(response.url) ?? placeId,
        };
      }

      const resolved = new URL(next, target).href;
      if (!isGoogleMapsUrl(resolved)) {
        logger.warn(
          { event: 'maps.resolve.offsite', host: new URL(resolved).hostname },
          'maps link redirected off Google; not following',
        );
        return { ...NO_PLACE, placeId };
      }

      placeId = placeIdIn(resolved) ?? placeId;

      const found = coordinatesIn(resolved);
      if (found) return { coordinates: found, placeId };
      target = resolved;
    }
  } catch (error) {
    logger.info({ event: 'maps.resolve.failed', error: String(error) }, 'maps link not resolved');
    return { ...NO_PLACE, placeId };
  }

  return { ...NO_PLACE, placeId };
}

export async function resolveCoordinates(
  mapsUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LatLng | null> {
  return (await resolvePlace(mapsUrl, fetchImpl)).coordinates;
}

const VIEWPORT_METRES = 2000;

export interface StoredPlace {
  mapsUrl: string | null;
  placeId: string | null;
  coordinates: LatLng | null;
}

function storedPlaceId(place: StoredPlace): string | null {
  return place.placeId ?? (place.mapsUrl ? placeIdIn(place.mapsUrl) : null);
}

export type MapKind = 'PLACE' | 'POINT' | 'NONE';

export function mapKindFor(place: StoredPlace): MapKind {
  if (place.mapsUrl && isEmbedUrl(place.mapsUrl)) {
    return storedPlaceId(place) ? 'PLACE' : 'POINT';
  }

  if (storedPlaceId(place)) return 'PLACE';
  if (place.coordinates) return 'POINT';
  return 'NONE';
}

export function embedUrlFor(place: StoredPlace & { label: string }): string | null {
  const { mapsUrl, coordinates, label } = place;

  if (mapsUrl && isEmbedUrl(mapsUrl)) return mapsUrl;

  const placeId = storedPlaceId(place);

  if (placeId) {
    const camera = coordinates ?? { lat: 0, lng: 0 };
    const pb = [
      '!1m18!1m12!1m3',
      `!1d${String(VIEWPORT_METRES)}`,
      `!2d${String(camera.lng)}`,
      `!3d${String(camera.lat)}`,
      '!2m3!1f0!2f0!3f0',
      '!3m2!1i1024!2i768!4f13.1',
      '!3m3!1m2',
      `!1s${placeId.replace(':', '%3A')}`,
      `!2s${blobText(label)}`,
      '!5e0',
      '!3m2!1sen!2sin',
      '!4v0',
      '!5m2!1sen!2sin',
    ].join('');

    return `https://www.google.com/maps/embed?pb=${pb}`;
  }

  if (coordinates) {
    return `https://www.google.com/maps?q=${String(coordinates.lat)},${String(coordinates.lng)}&z=16&output=embed`;
  }

  return null;
}

function isEmbedUrl(value: string): boolean {
  try {
    return new URL(value).pathname.startsWith('/maps/embed');
  } catch {
    return false;
  }
}

function blobText(value: string): string {
  return encodeURIComponent(value.slice(0, 80)).replaceAll('!', '%21');
}
