import { describe, expect, it } from 'vitest';

import { safeReturnPath } from '../../../src/lib/url.js';

/**
 * Where a sign-in may send somebody afterwards (**R63**). A path on this site
 * or the fallback — never a URL, because a login that redirects wherever the
 * query string says is an open redirect with a trusted domain in front of it.
 */
describe('safeReturnPath', () => {
  it.each(['/cars/2023-hyundai-creta?enquire=1', '/dealer/inventory', '/'])(
    'keeps the path %j',
    (path) => {
      expect(safeReturnPath(path, '/fallback')).toBe(path);
    },
  );

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'cars',
    '/ evil',
    '',
    undefined,
    null,
  ])('replaces %j with the fallback', (value) => {
    expect(safeReturnPath(value, '/fallback')).toBe('/fallback');
  });
});
