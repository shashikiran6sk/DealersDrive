import { isGoogleMapsUrl } from '@dealers-drive/contracts';

import { logger } from '../telemetry/logger.js';

/**
 * The yard's coordinates, recovered from the link the dealer pasted.
 *
 * ## Why this exists
 *
 * **R6** stores `mapsUrl` verbatim and deliberately does not parse it: a share
 * link survives the dealer moving their pin, carries the place's own name and
 * reviews, and opens the Maps app on a phone. That is exactly right for the
 * "Get directions" anchor, and it stays exactly right — nothing here changes
 * what is stored or what that button points at.
 *
 * What it cannot do is *draw* anything. A portfolio's location card had a grey
 * `ImageSlot` where the map should be, because the only thing the API knew
 * about the yard's position was an opaque URL. So the coordinates are read out
 * of the link **as well**, into the `lat`/`lng` columns that D6 left behind
 * unwritten, and the card draws a map at that point.
 *
 * A pin is a claim about where a business is, so it is only ever derived from
 * the dealer's own link. It is never geocoded from the typed address — a typed
 * address is several pins in one district, and the wrong one sends a buyer to
 * somebody else's gate.
 *
 * ## Two shapes of link
 *
 * A desktop copy-paste already carries the numbers, in one of several forms,
 * and `coordinatesIn` reads them without touching the network. The Share sheet
 * on a phone gives a `maps.app.goo.gl` short link instead, which carries
 * nothing until it is followed — so `resolveCoordinates` follows it.
 *
 * ## Following a link the dealer supplied
 *
 * The schema checked the host of what the dealer typed. It cannot check where
 * that redirects to, and every hop after the first is a URL chosen by somebody
 * else — which is the shape of an SSRF: a request the server makes, to an
 * address a stranger picked, from inside the network. So each hop is
 * re-validated against the same allow-list, redirects are followed by hand
 * rather than by `fetch`, and the chain is bounded.
 *
 * Nothing here is allowed to fail a write. A dealer saving their profile is
 * not doing anything that depends on Google answering, and the "Get
 * directions" button works whether this succeeds or not.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * The seam, so that two write paths can depend on "where is this yard" without
 * depending on a request to Google.
 *
 * It is a port for the ordinary reason the others are (§5.1) and for one
 * sharper one: without it, every unit test that saves a dealer profile issues a
 * real HTTP request while it runs. That is slow, it is flaky, and it makes the
 * suite's behaviour depend on the network of whoever runs it.
 */
export interface MapsPort {
  coordinatesFor(mapsUrl: string): Promise<LatLng | null>;
}

/** The real one. `noMapsLookup` is what a test passes instead. */
export function createMapsResolver(fetchImpl: typeof fetch = fetch): MapsPort {
  return { coordinatesFor: (mapsUrl) => resolveCoordinates(mapsUrl, fetchImpl) };
}

/**
 * Resolves nothing, ever, without asking anybody.
 *
 * The honest default for a test that is not about coordinates: a portfolio with
 * no map is a state the card renders on purpose, so a suite using this is
 * exercising a real shape rather than a disabled one.
 */
export const noMapsLookup: MapsPort = { coordinatesFor: () => Promise.resolve(null) };

/** Enough hops for a shortener, not enough to be a chain. */
const MAX_REDIRECTS = 5;

/** A dealer is waiting on this write. It is a nicety, not the point. */
const TIMEOUT_MS = 2500;

/**
 * The forms a Google Maps URL carries a position in, in the order they mean
 * the most.
 *
 *   · `@12.9165,79.1325,17z`  — the map's centre, in a place URL
 *   · `!3d12.9165!4d79.1325`  — the *pin*, in the data parameter
 *   · `!2d79.1325!3d12.9165`  — the pin again, in an **embed** URL's `pb`
 *   · `?q=`/`?query=`/`?ll=`  — a search or a share link built by hand
 *
 * `!3d…!4d…` is checked before `@…` because when both are present the first is
 * the marker and the second is wherever the map happened to be scrolled to.
 *
 * The embed form is the awkward one, and it is worth spelling out because it
 * reads like a typo. `pb` is a positional blob, and in it **`!2d` is the
 * longitude and `!3d` the latitude** — the opposite order to `!3d…!4d…` above,
 * where `3d` is the latitude. The two are matched separately for that reason,
 * and the embed pattern is checked last so a URL carrying a real `!3d…!4d…`
 * marker is never read through it.
 */
const PIN = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;
const CENTRE = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const EMBED_PIN = /!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/;
const PAIR = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;
const QUERY_KEYS = ['q', 'query', 'll', 'center', 'destination'];

/** Latitude and longitude, or nothing. `0,0` is the Atlantic, not a yard. */
function toLatLng(lat: string, lng: string): LatLng | null {
  const parsed = { lat: Number(lat), lng: Number(lng) };
  if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng)) return null;
  if (Math.abs(parsed.lat) > 90 || Math.abs(parsed.lng) > 180) return null;
  if (parsed.lat === 0 && parsed.lng === 0) return null;
  return parsed;
}

/** Reads a position straight out of a URL. No network, no failure mode. */
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

  // Longitude first here — see the note on EMBED_PIN.
  const embed = EMBED_PIN.exec(url.href);
  if (embed?.[1] && embed[2]) {
    const found = toLatLng(embed[2], embed[1]);
    if (found) return found;
  }

  return null;
}

/**
 * The same, following a short link if it has to.
 *
 * `fetchImpl` is injected so the tests can exercise the redirect chain — and
 * the host check on it — without reaching the internet.
 */
export async function resolveCoordinates(
  mapsUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LatLng | null> {
  const direct = coordinatesIn(mapsUrl);
  if (direct) return direct;

  // The schema already refused anything else, but this runs on a stored value
  // as well as on a submitted one, and a row written before the schema existed
  // is not a reason to make a request somewhere unexpected.
  if (!isGoogleMapsUrl(mapsUrl)) return null;

  let target = mapsUrl;

  try {
    for (let hop = 0; hop < MAX_REDIRECTS; hop += 1) {
      const response = await fetchImpl(target, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          // Google hands a bare client the mobile page, whose URL carries the
          // coordinates. Asking as a browser gets an interstitial instead.
          'User-Agent': 'Dealers-Drive/1.0 (+https://dealers-drive.com)',
        },
      });

      const next = response.headers.get('location');
      if (next === null) return coordinatesIn(response.url) ?? null;

      const resolved = new URL(next, target).href;
      if (!isGoogleMapsUrl(resolved)) {
        logger.warn(
          { event: 'maps.resolve.offsite', host: new URL(resolved).hostname },
          'maps link redirected off Google; not following',
        );
        return null;
      }

      const found = coordinatesIn(resolved);
      if (found) return found;
      target = resolved;
    }
  } catch (error) {
    // A timeout, a DNS failure, Google declining to answer. None of them is a
    // reason to fail the dealer's save.
    logger.info({ event: 'maps.resolve.failed', error: String(error) }, 'maps link not resolved');
    return null;
  }

  return null;
}
