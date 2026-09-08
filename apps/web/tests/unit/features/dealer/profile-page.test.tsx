import type { AuthSession } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type * as ApiModule from '@/lib/api';
import DealerProfilePage from '@/app/(dealer)/dealer/profile/page';
import { ApiError } from '@/lib/api';

/**
 * Who is allowed on `/dealer/profile`.
 *
 * Both of this page's reads sit behind `requireDealer`, which resolves a
 * *dealership* rather than merely a signed-in person — so it answers 401 to two
 * quite different visitors, and sending both to the same place is wrong in one
 * direction or the other. Catching the 401 cannot tell them apart; asking
 * `/v1/auth/me` can.
 *
 * The regression this pins: before the guard existed, an unauthenticated visit
 * threw the 401 straight through the render and Next answered **500** — a
 * stack trace where a sign-in screen belonged.
 */
const session = (next: AuthSession['next']): AuthSession =>
  ({
    user: { id: 'u1', fullName: 'Ramesh Kumar', email: 'owner@example.in', roleTitle: 'Owner' },
    dealer: null,
    next,
  }) as unknown as AuthSession;

const currentSession = vi.fn<() => Promise<AuthSession | null>>();
const apiGet = vi.fn();

vi.mock('@/lib/session', () => ({ currentSession: () => currentSession() }));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiGet: (path: string) => apiGet(path) as unknown,
}));

/** `redirect()` throws in the real router; the setup stub carries the target. */
async function redirectOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('NEXT_REDIRECT:')) return message.slice('NEXT_REDIRECT:'.length);
    throw error;
  }
  throw new Error('expected a redirect');
}

describe('the profile page guard', () => {
  it('sends a signed-out visitor to sign in, rather than throwing a 500', async () => {
    currentSession.mockResolvedValue(null);

    expect(await redirectOf(DealerProfilePage())).toBe('/dealer/login?error=session_expired');
    // And nothing was fetched with a session that does not exist.
    expect(apiGet).not.toHaveBeenCalled();
  });

  /**
   * The second visitor the 401 hides: signed in, but with no dealership yet.
   * There is no profile to edit until there is one, and the wizard is where
   * that gets fixed.
   */
  it('sends a dealer who has not finished onboarding to the wizard', async () => {
    currentSession.mockResolvedValue(session('ONBOARDING'));

    expect(await redirectOf(DealerProfilePage())).toBe('/dealer/onboarding');
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('lets a dealership through, and reads its own record', async () => {
    currentSession.mockResolvedValue(session('DASHBOARD'));
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
    currentSession.mockResolvedValue(session('DASHBOARD'));
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

  /** A 500 is still a 500 when it genuinely is one — this guard is not a mute. */
  it('does not swallow a failure that is not about the session', async () => {
    currentSession.mockRejectedValue(
      new ApiError({ type: 'about:blank', title: 'Internal', status: 500, code: 'INTERNAL' }),
    );

    await expect(DealerProfilePage()).rejects.toThrow(ApiError);
  });
});
