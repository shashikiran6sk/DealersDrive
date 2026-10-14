import { describe, expect, it } from 'vitest';
import { SavedSlugsQuery, SavedVehicleSlugs } from '../../src/saved.js';

describe('optional native saved-state pagination', () => {
  it('keeps legacy responses valid and bounds cursor controls', () => {
    expect(SavedVehicleSlugs.parse({ slugs: ['car'] })).toEqual({ slugs: ['car'] });
    expect(SavedSlugsQuery.parse({ limit: '500' })).toEqual({ limit: 500 });
    for (const query of [
      { limit: 501 },
      { limit: 0 },
      { customerId: 'foreign' },
      { cursor: 'x'.repeat(501) },
    ])
      expect(SavedSlugsQuery.safeParse(query).success).toBe(false);
  });
  it('accepts bounded keyset pages while rejecting oversized saved state', () => {
    expect(
      SavedVehicleSlugs.parse({ slugs: [], page: { hasMore: false, nextCursor: null } }).page
        ?.hasMore,
    ).toBe(false);
    expect(
      SavedVehicleSlugs.safeParse({ slugs: Array.from({ length: 501 }, () => 'car') }).success,
    ).toBe(false);
  });
});
