import { describe, expect, it } from 'vitest';

import { DEFAULT_API_BASE, parseDate, parseRenderArgs, USAGE } from '../src/cli/args';

const NOW = new Date(Date.UTC(2026, 10, 4, 15, 30));

describe('parseRenderArgs', () => {
  it('defaults to every dealership, the production API and today', () => {
    expect(parseRenderArgs([], NOW)).toEqual({
      dealers: [],
      apiBase: DEFAULT_API_BASE,
      outDir: 'out',
      musicPath: null,
      asOf: new Date(Date.UTC(2026, 10, 4)),
      propsOnly: false,
      silent: false,
      concurrency: null,
      help: false,
    });
  });

  it('reads every option, ignoring the pnpm separator', () => {
    const options = parseRenderArgs(
      [
        '--',
        '--dealer',
        'a',
        '--dealer',
        'b',
        '--api',
        'http://localhost:4000',
        '--out',
        'reels',
        '--music',
        'track.mp3',
        '--as-of',
        '2026-12-01',
        '--props-only',
        '--silent',
        '--concurrency',
        '2',
        '--help',
      ],
      NOW,
    );
    expect(options).toMatchObject({
      dealers: ['a', 'b'],
      apiBase: 'http://localhost:4000',
      outDir: 'reels',
      musicPath: 'track.mp3',
      propsOnly: true,
      silent: true,
      concurrency: 2,
      help: true,
    });
    expect(options.asOf.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  it('rejects unknown options and a bad concurrency', () => {
    expect(() => parseRenderArgs(['--dealers', 'a'], NOW)).toThrow();
    expect(() => parseRenderArgs(['--concurrency', '0'], NOW)).toThrow(/positive whole number/);
  });

  it('documents itself', () => {
    expect(USAGE).toContain('--dealer <slug>');
  });
});

describe('parseDate', () => {
  it('rejects malformed and impossible dates', () => {
    expect(() => parseDate('04-11-2026')).toThrow(/YYYY-MM-DD/);
    expect(() => parseDate('2026-02-30')).toThrow(/not a real date/);
  });
});
