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
 * Everything a Google Maps link is worth reading for.
 *
 * The pin is what centres a map. The **place id** is what makes it a map *of a
 * dealership* rather than a map with a dot on it: Google's own feature id for
 * the place, the `0x…:0x…` pair that appears in a place URL's `data` parameter
 * and in an embed's `pb` blob. Handed back to Google in an embed it returns the
 * place card — the yard's name, its address, its rating and its review count,
 * and a directions control inside the frame.
 *
 * The two are independent. A `?ftid=` link carries an id and no coordinates; a
 * `/maps/@12.9,79.1,17z` link carries coordinates and names nothing. Either on
 * its own draws something worth looking at, so both are collected and neither
 * waits for the other.
 */
export interface MapsPlace {
  /** Where the map is centred, when the link said. */
  coordinates: LatLng | null;
  /** Which place it is, when the link said. `0x…:0x…`, lower case. */
  placeId: string | null;
}

/** The link said nothing. Not an error — a share link often carries neither. */
export const NO_PLACE: MapsPlace = { coordinates: null, placeId: null };

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
  placeFor(mapsUrl: string): Promise<MapsPlace>;
}

/** The real one. `noMapsLookup` is what a test passes instead. */
export function createMapsResolver(fetchImpl: typeof fetch = fetch): MapsPort {
  return { placeFor: (mapsUrl) => resolvePlace(mapsUrl, fetchImpl) };
}

/**
 * Resolves nothing, ever, without asking anybody.
 *
 * The honest default for a test that is not about coordinates: a portfolio with
 * no map is a state the card renders on purpose, so a suite using this is
 * exercising a real shape rather than a disabled one.
 */
export const noMapsLookup: MapsPort = { placeFor: () => Promise.resolve(NO_PLACE) };

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
 * Which place a URL names, if it names one.
 *
 * `0x3a525df9971c98e5:0x35fc11465038924f` is Google's own feature id, and it
 * turns up in three places a dealer might copy from:
 *
 *   · `?ftid=0x…:0x…`                         — the explicit parameter
 *   · `…/data=!4m…!3m4!1s0x…:0x…!8m2!3d…!4d…`  — a desktop place URL
 *   · `…/embed?pb=…!3m3!1m2!1s0x…%3A0x…!2s…`   — the Share panel's embed
 *
 * All three write it the same way, `1s` followed by the pair, so one pattern
 * finds it wherever it sits. The colon is percent-encoded inside a `pb` blob
 * and bare everywhere else, hence the alternation.
 *
 * `0x0:0x0` is refused. It is what a URL carries where a real id would go when
 * the feature was never resolved — the seed writes it, and Google answers a
 * blank frame for it rather than an error, which is the worst of both.
 */
const PLACE_ID = /!1s(0x[0-9a-f]+)(?::|%3A)(0x[0-9a-f]+)/i;
const FTID = /^(0x[0-9a-f]+):(0x[0-9a-f]+)$/i;

/** Reads a place id straight out of a URL. No network, no failure mode. */
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

/** Lower case, because the same place is written both ways across Google's URLs. */
function identity(feature: string, cid: string): string | null {
  const id = `${feature.toLowerCase()}:${cid.toLowerCase()}`;
  return id === '0x0:0x0' ? null : id;
}

/**
 * What the link says, following a short one if it has to.
 *
 * The walk stops at the first hop that yields **coordinates**, which is the
 * condition it always stopped on — a place URL carries the id and the pin in
 * the same `data` parameter, so in practice both are in hand at once. A hop
 * that names a place without placing it does not end the walk, but it is not
 * forgotten either: the id is kept and returned with whatever the walk finds
 * afterwards, or on its own if it finds nothing.
 *
 * `fetchImpl` is injected so the tests can exercise the redirect chain — and
 * the host check on it — without reaching the internet.
 */
export async function resolvePlace(
  mapsUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MapsPlace> {
  let placeId = placeIdIn(mapsUrl);

  const direct = coordinatesIn(mapsUrl);
  if (direct) return { coordinates: direct, placeId };

  // The schema already refused anything else, but this runs on a stored value
  // as well as on a submitted one, and a row written before the schema existed
  // is not a reason to make a request somewhere unexpected.
  if (!isGoogleMapsUrl(mapsUrl)) return { ...NO_PLACE, placeId };

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
    // A timeout, a DNS failure, Google declining to answer. None of them is a
    // reason to fail the dealer's save.
    logger.info({ event: 'maps.resolve.failed', error: String(error) }, 'maps link not resolved');
    return { ...NO_PLACE, placeId };
  }

  return { ...NO_PLACE, placeId };
}

/**
 * The coordinate half on its own, for callers that only want the pin.
 *
 * `resolvePlace` is the walk; this is the question the walk was originally
 * written to answer, kept because it is the one most callers are asking.
 */
export async function resolveCoordinates(
  mapsUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LatLng | null> {
  return (await resolvePlace(mapsUrl, fetchImpl)).coordinates;
}

/**
 * How wide a view of the yard, in metres. The `!1d` slot in a `pb` blob is a
 * distance rather than a zoom level, and Google honours it exactly. Two
 * kilometres is the frame that shows which road the gate is on without
 * shrinking the surrounding town to nothing.
 */
const VIEWPORT_METRES = 2000;

/**
 * The map the portfolio draws, as a URL its `<iframe>` can point at.
 *
 * ## Why not simply `?q=lat,lng&output=embed`
 *
 * Because that draws a dot. The dealer gets a pin in a field of grey, with no
 * name on it, nothing to say the buyer is looking at the right gate, and no way
 * to start navigating without leaving the page. What Google's own Share panel
 * hands out instead is an `/maps/embed?pb=…` URL, and the difference is not
 * cosmetic: it carries the **place id**, so the frame comes back with the
 * dealership's name, its address, its rating and review count, a control that
 * opens directions, and the zoom buttons — the thing a buyer working out
 * whether to drive there actually wants.
 *
 * ## Three answers, in the order they are worth having
 *
 * 1. **The dealer pasted an embed URL.** Then it is already the map they chose,
 *    complete with the place, and it is returned untouched. Rebuilding it from
 *    parts we parsed out of it could only lose something.
 * 2. **We know the place id** — from the column, or read back out of whatever
 *    link is stored. A blob is assembled around it. The coordinates go in as
 *    the camera, but Google re-centres on the place's own pin and ignores them,
 *    so they matter only as the fallback if the id ever stops resolving.
 * 3. **Only coordinates.** The dot, as before. Honest, and better than nothing.
 *
 * and no link at all, or one that said nothing, is `null` — the card renders
 * its slot, which is a state it has always had.
 *
 * The blob's leading `!1m18!1m12!1m3` are group lengths, so the *number* of
 * elements is load-bearing even though their values are not. Substitute the
 * leaves; never add or drop a field.
 */
export function embedUrlFor(place: {
  mapsUrl: string | null;
  placeId: string | null;
  coordinates: LatLng | null;
  label: string;
}): string | null {
  const { mapsUrl, coordinates, label } = place;

  if (mapsUrl && isEmbedUrl(mapsUrl)) return mapsUrl;

  // The column when it was written, and the link when it was not — which is
  // every dealership that saved a place URL before the column existed, since
  // the migration deliberately backfills nothing.
  const placeId = place.placeId ?? (mapsUrl ? placeIdIn(mapsUrl) : null);

  if (placeId) {
    const camera = coordinates ?? { lat: 0, lng: 0 };
    const pb = [
      '!1m18!1m12!1m3',
      `!1d${String(VIEWPORT_METRES)}`,
      // Longitude before latitude — see the note on EMBED_PIN.
      `!2d${String(camera.lng)}`,
      `!3d${String(camera.lat)}`,
      '!2m3!1f0!2f0!3f0',
      '!3m2!1i1024!2i768!4f13.1',
      '!3m3!1m2',
      `!1s${placeId.replace(':', '%3A')}`,
      `!2s${blobText(label)}`,
      '!5e0',
      '!3m2!1sen!2sin',
      // Google puts a timestamp here to bust its own cache. A constant is
      // deliberate: this URL is rendered on a page Next caches and a crawler
      // revisits, and one that changed on every request would defeat both.
      '!4v0',
      '!5m2!1sen!2sin',
    ].join('');

    return `https://www.google.com/maps/embed?pb=${pb}`;
  }

  if (coordinates) {
    // `q` is the pin and `z` the zoom; `output=embed` is the keyless renderer.
    return `https://www.google.com/maps?q=${String(coordinates.lat)},${String(coordinates.lng)}&z=16&output=embed`;
  }

  return null;
}

/** The Share panel's second tab. Its `src`, or the whole element unwrapped. */
function isEmbedUrl(value: string): boolean {
  try {
    return new URL(value).pathname.startsWith('/maps/embed');
  } catch {
    // A row written before the URL was validated. Not a map, then.
    return false;
  }
}

/**
 * A label, safe to sit in a positional blob.
 *
 * It is only a hint — Google renders the place's own name from the id, not
 * this — but an unescaped `!` would end the field early and shift every
 * element after it, so the one character that carries structure is encoded
 * beyond what `encodeURIComponent` bothers with.
 */
function blobText(value: string): string {
  return encodeURIComponent(value.slice(0, 80)).replaceAll('!', '%21');
}
