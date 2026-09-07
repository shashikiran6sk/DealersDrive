import { describe, expect, it, vi } from 'vitest';

import {
  coordinatesIn,
  embedUrlFor,
  mapKindFor,
  placeIdIn,
  resolveCoordinates,
  resolvePlace,
} from '../../../../src/platform/maps/maps-link.js';

/**
 * Unit tests for `src/platform/maps/maps-link.ts`.
 *
 * Two properties matter here, and they pull in opposite directions.
 *
 * The **useful** one: a dealer's link becomes a pin, in whichever of the half
 * dozen shapes Google hands out, so the portfolio can draw a map of the yard.
 *
 * The **safe** one: following that link is a request the server makes to an
 * address a stranger chose. The schema vetted the first hop and can vet nothing
 * after it, so every hop is re-checked — and the cases below are as much about
 * where this refuses to go as about what it manages to read.
 */
describe('coordinatesIn', () => {
  it('reads the pin from a place URL, preferring it to the map centre', () => {
    // `@…` is wherever the map happened to be scrolled to; `!3d…!4d…` is the
    // marker. A URL carrying both means the two differ, and the marker wins.
    expect(
      coordinatesIn(
        'https://www.google.com/maps/place/Yard/@12.8000,79.0000,17z/data=!3m1!4b1!4m5!3m4!1s0x0!8m2!3d12.9165!4d79.1325',
      ),
    ).toEqual({ lat: 12.9165, lng: 79.1325 });
  });

  it('falls back to the map centre when there is no marker', () => {
    expect(coordinatesIn('https://www.google.com/maps/@12.9165,79.1325,17z')).toEqual({
      lat: 12.9165,
      lng: 79.1325,
    });
  });

  it('reads a share link built as a search', () => {
    // The shape the dev seed writes, and what "Copy link" gives on desktop.
    expect(
      coordinatesIn('https://www.google.com/maps/search/?api=1&query=12.9165,79.1325'),
    ).toEqual({ lat: 12.9165, lng: 79.1325 });
  });

  it('accepts a negative pair, because the product will not always be in India', () => {
    expect(coordinatesIn('https://www.google.com/maps?q=-33.8688,151.2093')).toEqual({
      lat: -33.8688,
      lng: 151.2093,
    });
  });

  /**
   * The embed URL, whose `pb` blob is positional and puts **longitude before
   * latitude** — `!2d` then `!3d`, the reverse of the `!3d…!4d…` marker above.
   * Reading it in the order it is written would put a Vellore yard in the
   * Arabian Sea off Gujarat, which is a plausible-looking wrong answer rather
   * than an obviously wrong one, and so worth a test of its own.
   */
  it('reads the pin out of an embed URL, whose blob is longitude-first', () => {
    expect(
      coordinatesIn(
        'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3888.5!2d79.1453092!3d12.9346947!3m2!1i1024!2i768!4f13.1',
      ),
    ).toEqual({ lat: 12.9346947, lng: 79.1453092 });
  });

  it('prefers a real marker to the embed blob when a URL somehow has both', () => {
    // `!3d…!4d…` is checked first, so `!2d…!3d…` can never capture across it.
    expect(
      coordinatesIn('https://www.google.com/maps/x?pb=!2d10.0!3d20.0!8m2!3d12.9165!4d79.1325'),
    ).toEqual({ lat: 12.9165, lng: 79.1325 });
  });

  it('reads nothing from a short link, which is the whole reason for the fetch', () => {
    expect(coordinatesIn('https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9')).toBeNull();
  });

  it('refuses a pair that is not a place on Earth', () => {
    expect(coordinatesIn('https://www.google.com/maps?q=99.0,181.0')).toBeNull();
    // Null Island is what a missing value looks like once it has been parsed,
    // and a yard in the Atlantic is a worse answer than no map.
    expect(coordinatesIn('https://www.google.com/maps?q=0,0')).toBeNull();
  });

  it('refuses text where a coordinate should be', () => {
    expect(coordinatesIn('https://www.google.com/maps?q=Sri+Lakshmi+Motors,+Vellore')).toBeNull();
    expect(coordinatesIn('not a url at all')).toBeNull();
  });
});

/** A `Response`-shaped stub: `location` set means a redirect. */
function reply(location: string | null, url = 'https://maps.app.goo.gl/x'): Response {
  return {
    url,
    headers: { get: (name: string) => (name === 'location' ? location : null) },
  } as unknown as Response;
}

describe('resolveCoordinates', () => {
  it('answers from the URL itself without touching the network', async () => {
    const fetchImpl = vi.fn();

    expect(
      await resolveCoordinates(
        'https://www.google.com/maps/search/?api=1&query=12.9165,79.1325',
        fetchImpl as unknown as typeof fetch,
      ),
    ).toEqual({ lat: 12.9165, lng: 79.1325 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('follows a short link to the place URL behind it', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(reply('https://www.google.com/maps/place/Yard/@12.9165,79.1325,17z'));

    expect(
      await resolveCoordinates(
        'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
        fetchImpl as unknown as typeof fetch,
      ),
    ).toEqual({ lat: 12.9165, lng: 79.1325 });
  });

  it('does not let fetch follow redirects on its own', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(reply('https://www.google.com/maps/@12.9,79.1,17z'));

    await resolveCoordinates('https://maps.app.goo.gl/x', fetchImpl);

    // `redirect: 'manual'` is what makes the host check below reachable at all.
    // Left to itself, `fetch` would follow the chain and only then hand back a
    // response — from wherever it ended up.
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
  });

  /**
   * The one that matters. A shortener the dealer controls the target of is a
   * way to make this server issue a request to an address of somebody else's
   * choosing — a cloud metadata endpoint, an internal admin page. The host is
   * re-checked at every hop, and an off-Google redirect ends the walk rather
   * than being followed.
   */
  it('stops at a redirect that leaves Google', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply('http://169.254.169.254/latest/meta-data/'));

    expect(
      await resolveCoordinates('https://maps.app.goo.gl/x', fetchImpl as unknown as typeof fetch),
    ).toBeNull();
    // And it was never requested: the check happens before the next hop.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('refuses to fetch a stored link that is not a Google host at all', async () => {
    const fetchImpl = vi.fn();

    // The schema vets what a dealer submits. This also runs over stored values,
    // and a row written before the schema existed is not a reason to make a
    // request somewhere unexpected.
    expect(
      await resolveCoordinates('https://example.test/maps', fetchImpl as unknown as typeof fetch),
    ).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('gives up rather than following a chain forever', async () => {
    // Each hop is a fresh Google URL with no coordinates in it.
    let hop = 0;
    const fetchImpl = vi.fn(() =>
      Promise.resolve(reply(`https://www.google.com/maps/hop/${String((hop += 1))}`)),
    );

    expect(
      await resolveCoordinates('https://maps.app.goo.gl/x', fetchImpl as unknown as typeof fetch),
    ).toBeNull();
    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(5);
  });

  /**
   * Nothing here may fail a dealer's save. Google being slow, or down, or
   * declining to answer a server-side request, costs the map — and the "Get
   * directions" button, which is the thing a buyer actually presses, is
   * `mapsUrl` and is unaffected.
   */
  it('answers null when the request fails, rather than throwing', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('TimeoutError'));

    await expect(
      resolveCoordinates('https://maps.app.goo.gl/x', fetchImpl as unknown as typeof fetch),
    ).resolves.toBeNull();
  });

  it('answers null when the chain ends somewhere with no coordinates', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(reply(null, 'https://www.google.com/maps/place/Yard'));

    expect(
      await resolveCoordinates('https://maps.app.goo.gl/x', fetchImpl as unknown as typeof fetch),
    ).toBeNull();
  });
});

/**
 * The place id is the difference between a map with a dot on it and a map of a
 * dealership: handed back to Google it returns the place card — the yard's
 * name, its address, its rating and review count, and a directions control
 * inside the frame. It is written the same way wherever it appears, which is
 * what makes one pattern enough.
 */
describe('placeIdIn', () => {
  it('reads the id out of a desktop place URL', () => {
    expect(
      placeIdIn(
        'https://www.google.com/maps/place/Sakthi+Cars/@12.9797,80.2000,17z/data=!3m1!4b1!4m6!3m5!1s0x3a525df9971c98e5:0x35fc11465038924f!8m2!3d12.9797!4d80.2000',
      ),
    ).toBe('0x3a525df9971c98e5:0x35fc11465038924f');
  });

  it('reads it out of an embed blob, where the colon is encoded', () => {
    expect(
      placeIdIn(
        'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2000!2d80.2!3d12.97!3m3!1m2!1s0x3a525df9971c98e5%3A0x35fc11465038924f!2sSakthi%20Cars!5e0',
      ),
    ).toBe('0x3a525df9971c98e5:0x35fc11465038924f');
  });

  it('reads the explicit parameter', () => {
    expect(
      placeIdIn('https://www.google.com/maps?ftid=0x3A525DF9971C98E5:0x35FC11465038924F'),
    ).toBe('0x3a525df9971c98e5:0x35fc11465038924f');
  });

  /**
   * The same place is written in both cases across Google's own URLs, and two
   * spellings of one id would store two rows' worth of the same fact.
   */
  it('lower-cases, so one place is one string', () => {
    expect(placeIdIn('https://www.google.com/maps?ftid=0xABC:0xDEF')).toBe('0xabc:0xdef');
  });

  /**
   * `0x0:0x0` is what a URL carries where an id would go when the feature was
   * never resolved — the dev seed writes it. Google answers a blank frame for
   * it rather than an error, which is the worst of both: no place card, and
   * nothing to say why.
   */
  it('refuses the null id, which draws a blank frame', () => {
    expect(
      placeIdIn('https://www.google.com/maps/place/Yard/data=!4m5!3m4!1s0x0:0x0!8m2!3d12!4d79'),
    ).toBeNull();
  });

  it('reads nothing from a link that names no place', () => {
    expect(placeIdIn('https://www.google.com/maps/search/?api=1&query=12.9165,79.1325')).toBeNull();
    expect(placeIdIn('https://maps.app.goo.gl/abc123')).toBeNull();
    expect(placeIdIn('not a url at all')).toBeNull();
  });
});

describe('resolvePlace', () => {
  /**
   * A place URL carries the id and the pin in the same `data` parameter, so
   * the walk that was already stopping at the coordinates comes away with both
   * for free.
   */
  it('brings the place back with the pin, from one hop', async () => {
    const place =
      'https://www.google.com/maps/place/Yard/data=!4m6!3m5!1s0xaaa:0xbbb!8m2!3d12.9165!4d79.1325';
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 302, headers: { location: place } }));

    expect(await resolvePlace('https://maps.app.goo.gl/abc123', fetchImpl)).toEqual({
      coordinates: { lat: 12.9165, lng: 79.1325 },
      placeId: '0xaaa:0xbbb',
    });
  });

  /**
   * The id and the pin do not have to arrive together, and a hop that names a
   * place without placing it must not end the walk — but must not be thrown
   * away either, because the next hop may be the one with the coordinates.
   */
  it('keeps a place id found before the pin', async () => {
    const named = 'https://www.google.com/maps?ftid=0xaaa:0xbbb';
    const placed = 'https://www.google.com/maps/@12.9165,79.1325,17z';
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: named } }))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: placed } }));

    expect(await resolvePlace('https://maps.app.goo.gl/abc123', fetchImpl)).toEqual({
      coordinates: { lat: 12.9165, lng: 79.1325 },
      placeId: '0xaaa:0xbbb',
    });
  });

  /**
   * A place id on its own still draws the map — Google centres the frame on the
   * place's own pin — so a link that named a place and never placed it is not
   * the same as a link that said nothing.
   */
  it('answers with a place and no pin, which is still a map', async () => {
    expect(await resolvePlace('https://www.google.com/maps?ftid=0xaaa:0xbbb', vi.fn())).toEqual({
      coordinates: null,
      placeId: '0xaaa:0xbbb',
    });
  });
});

/**
 * The builder that turns all of that into the thing an `<iframe>` points at.
 *
 * Its three answers are ordered by how much they are worth, and the ordering is
 * the behaviour: an embed the dealer chose beats one assembled from its parts,
 * and a named place beats a bare coordinate every time, because only the first
 * of each pair comes back with the yard's name, rating and directions on it.
 */
describe('embedUrlFor', () => {
  const label = 'Sri Lakshmi Motors';

  it('returns an embed the dealer pasted, untouched', () => {
    // Already the map they chose, with the place already in it. Rebuilding it
    // from what we parsed back out could only lose something.
    const pasted =
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d164827!2d80.09!3d12.96!3m3!1m2!1s0xaaa%3A0xbbb!2sSakthi%20Cars!5e0';

    expect(embedUrlFor({ mapsUrl: pasted, placeId: null, coordinates: null, label })).toBe(pasted);
  });

  it('builds a place embed around a stored id', () => {
    const url = embedUrlFor({
      mapsUrl: 'https://maps.app.goo.gl/abc123',
      placeId: '0xaaa:0xbbb',
      coordinates: { lat: 12.9165, lng: 79.1325 },
      label,
    });

    expect(url).toBe(
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2000!2d79.1325!3d12.9165' +
        '!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xaaa%3A0xbbb' +
        '!2sSri%20Lakshmi%20Motors!5e0!3m2!1sen!2sin!4v0!5m2!1sen!2sin',
    );
  });

  /**
   * The migration backfills nothing, so every dealership that saved a place URL
   * before the column existed has a null `placeId` and an id sitting in plain
   * sight in the link beside it. Reading it back out is what makes those rows
   * draw a place card today rather than the next time the dealer saves.
   */
  it('falls back to the id inside the stored link', () => {
    const url = embedUrlFor({
      mapsUrl:
        'https://www.google.com/maps/place/Yard/data=!4m6!3m5!1s0xaaa:0xbbb!8m2!3d12.9165!4d79.1325',
      placeId: null,
      coordinates: { lat: 12.9165, lng: 79.1325 },
      label,
    });

    expect(url).toContain('!1s0xaaa%3A0xbbb');
  });

  /**
   * Google re-centres on the place's own pin and ignores the camera, so an id
   * with no coordinates still draws the right map. `0,0` is the Atlantic, and
   * it is what the frame falls back to only if the id itself stops resolving —
   * which is a worse map than none, but a rarer one than no map at all.
   */
  it('draws a place that was never given coordinates', () => {
    const url = embedUrlFor({
      mapsUrl: null,
      placeId: '0xaaa:0xbbb',
      coordinates: null,
      label,
    });

    expect(url).toContain('!1d2000!2d0!3d0');
    expect(url).toContain('!1s0xaaa%3A0xbbb');
  });

  /**
   * `!` is what separates fields in a positional blob, so a brand name carrying
   * one would end the label early and shift every element after it — including
   * the id. `encodeURIComponent` leaves `!` alone, which is exactly the gap.
   */
  it('escapes a brand name that would break the blob', () => {
    const url = embedUrlFor({
      mapsUrl: null,
      placeId: '0xaaa:0xbbb',
      coordinates: null,
      label: 'Cars! & Co',
    });

    expect(url).toContain('!2sCars%21%20%26%20Co!5e0');
  });

  it('falls back to the plain pin when nothing named a place', () => {
    expect(
      embedUrlFor({
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=12.9165,79.1325',
        placeId: null,
        coordinates: { lat: 12.9165, lng: 79.1325 },
        label,
      }),
    ).toBe('https://www.google.com/maps?q=12.9165,79.1325&z=16&output=embed');
  });

  /** No pin and no place is the state the card renders its slot for. */
  it('draws nothing when the link said nothing', () => {
    expect(
      embedUrlFor({
        mapsUrl: 'https://maps.app.goo.gl/abc123',
        placeId: null,
        coordinates: null,
        label,
      }),
    ).toBeNull();

    expect(embedUrlFor({ mapsUrl: null, placeId: null, coordinates: null, label })).toBeNull();
  });
});

/**
 * R20 — the same question `embedUrlFor` answers, asked without building a URL,
 * because the dealer's own profile screen has to say which of the three a
 * stored link produces and there is no map on that screen to look at.
 *
 * The last test here is the one that matters: the two functions must agree, or
 * the form ends up claiming a Google listing over a page that is drawing a dot.
 */
describe('mapKindFor', () => {
  const PLACE_URL =
    'https://www.google.com/maps/place/Yard/data=!4m6!3m5!1s0xaaa:0xbbb!8m2!3d12.9165!4d79.1325';
  const PIN_URL = 'https://www.google.com/maps/search/?api=1&query=12.9165,79.1325';
  const HERE = { lat: 12.9165, lng: 79.1325 };

  it('is PLACE when the column names one', () => {
    expect(mapKindFor({ mapsUrl: PIN_URL, placeId: '0xaaa:0xbbb', coordinates: HERE })).toBe(
      'PLACE',
    );
  });

  /** The rows the migration deliberately did not backfill. */
  it('is PLACE when only the stored link names one', () => {
    expect(mapKindFor({ mapsUrl: PLACE_URL, placeId: null, coordinates: HERE })).toBe('PLACE');
  });

  it('is PLACE for a pasted embed whose blob names a place', () => {
    const pasted =
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d164827!2d80.09!3d12.96' +
      '!3m3!1m2!1s0xaaa%3A0xbbb!2sSakthi%20Cars!5e0';

    expect(mapKindFor({ mapsUrl: pasted, placeId: null, coordinates: null })).toBe('PLACE');
  });

  it('is POINT for a pasted embed that names none', () => {
    const pasted = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d164827!2d80.09!3d12.96';

    expect(mapKindFor({ mapsUrl: pasted, placeId: null, coordinates: null })).toBe('POINT');
  });

  it('is POINT when there is a pin and nothing named', () => {
    expect(mapKindFor({ mapsUrl: PIN_URL, placeId: null, coordinates: HERE })).toBe('POINT');
  });

  it('is NONE when the link said neither, and when there is no link', () => {
    expect(
      mapKindFor({ mapsUrl: 'https://maps.app.goo.gl/abc123', placeId: null, coordinates: null }),
    ).toBe('NONE');
    expect(mapKindFor({ mapsUrl: null, placeId: null, coordinates: null })).toBe('NONE');
  });

  /**
   * The correspondence, stated as a property rather than trusted to a comment:
   * `NONE` is exactly the set of rows the portfolio draws no map for, and
   * anything else is a row it does.
   */
  it('says NONE for exactly the rows embedUrlFor draws nothing for', () => {
    const rows = [
      { mapsUrl: PLACE_URL, placeId: null, coordinates: HERE },
      { mapsUrl: PIN_URL, placeId: '0xaaa:0xbbb', coordinates: HERE },
      { mapsUrl: PIN_URL, placeId: null, coordinates: HERE },
      { mapsUrl: 'https://maps.app.goo.gl/abc123', placeId: null, coordinates: null },
      { mapsUrl: null, placeId: null, coordinates: null },
      { mapsUrl: null, placeId: '0xaaa:0xbbb', coordinates: null },
    ];

    for (const row of rows) {
      const drawn = embedUrlFor({ ...row, label: 'Sri Lakshmi Motors' });
      expect(mapKindFor(row) === 'NONE').toBe(drawn === null);
    }
  });
});
