import { describe, expect, it, vi } from 'vitest';

import { coordinatesIn, resolveCoordinates } from '../../../../src/platform/maps/maps-link.js';

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
