import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type * as ApiModule from '@/lib/api';
import DealerProfilePage from '@/app/(dealer)/dealer/profile/page';

/**
 * What `/dealer/profile` renders, now that it no longer decides who may see it.
 *
 * **The guard moved to the layout (R31).** It was written here at F046 with a
 * note saying F047 should lift it once one route stopped being the whole
 * segment; `console-layout.test.tsx` is where the three visitor cases live now,
 * including the regression that produced them — an unauthenticated visit that
 * threw a 401 through the render and had Next answer 500.
 *
 * What is left here is the page's own judgement: the completeness meter, and
 * whether it points a dealer at a box they can type in.
 */
const apiGet = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiGet: (path: string) => apiGet(path) as unknown,
}));

describe('the profile page', () => {
  it('reads its own record and its own completeness', async () => {
    apiGet.mockImplementation((path: string) =>
      path.includes('completeness')
        ? Promise.resolve({ isComplete: true, canSubmit: true, percent: 100, steps: [] })
        : Promise.resolve({
            slug: 'x',
            status: 'ACTIVE',
            statusLabel: 'Active',
            legalName: 'Sri Lakshmi Motors Pvt Ltd',
            brandName: 'Sri Lakshmi Motors',
            contact: {},
            address: {},
            specialities: [],
          }),
    );

    await expect(DealerProfilePage()).resolves.toBeDefined();
    expect(apiGet).toHaveBeenCalledWith('/v1/dealer');
    expect(apiGet).toHaveBeenCalledWith('/v1/dealer/completeness');
  });

  /**
   * **R27 — the meter must not point at a box the dealer cannot type in.**
   *
   * It reports the truth either way; what changes is whether a person reading
   * it has anywhere to go. `tagline` is theirs to fix, so the note stays away.
   * `mapsUrl` is part of what the verification checked, so the note appears —
   * a warning with no action attached reads as a broken page.
   */
  it.each([
    ['tagline', false],
    ['mapsUrl', true],
    ['district', true],
  ])('says who fixes an outstanding %s', async (field, expectsNote) => {
    apiGet.mockImplementation((path: string) =>
      path.includes('completeness')
        ? Promise.resolve({
            isComplete: false,
            canSubmit: false,
            percent: 80,
            steps: [{ key: 'business', label: 'Business', complete: false, missing: [field] }],
          })
        : Promise.resolve({
            slug: 'x',
            status: 'ACTIVE',
            statusLabel: 'Active',
            legalName: 'Sri Lakshmi Motors Pvt Ltd',
            brandName: 'Sri Lakshmi Motors',
            contact: {},
            address: {},
            specialities: [],
          }),
    );

    render(await DealerProfilePage());

    const note = screen.queryByText(/not editable here/i);
    expect(note === null).toBe(!expectsNote);
  });
});
