import { describe, expect, it } from 'vitest';

import { qrMatrix } from '../src/lib/qr';

describe('qrMatrix', () => {
  it('returns a square grid with the three finder patterns set', () => {
    const rows = qrMatrix('https://www.dealers-drive.com/dealers/sample');
    const size = rows.length;
    expect(size).toBeGreaterThanOrEqual(21);
    rows.forEach((row) => expect(row).toHaveLength(size));
    expect(rows[0]?.[0]).toBe(true);
    expect(rows[0]?.[size - 1]).toBe(true);
    expect(rows[size - 1]?.[0]).toBe(true);
  });
});
