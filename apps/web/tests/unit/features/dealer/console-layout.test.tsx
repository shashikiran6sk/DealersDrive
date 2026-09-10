import type { AuthSession } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type * as ApiModule from '@/lib/api';
import DealerLayout from '@/app/(dealer)/dealer/layout';
import { ApiError } from '@/lib/api';

/**
 * Who is allowed into the dealer console, and what the shell puts around them
 * once they are (**R31**).
 *
 * The guard is on the layout rather than on a page, which is the point of it:
 * every screen beneath `(dealer)/dealer/` inherits it, so a console page added
 * later cannot forget to ask. It was written on the profile page at F046 with
 * a note saying F047 should lift it here; these three cases came with it.
 *
 * `GET /v1/dealer` answers 401 to two quite different visitors and deliberately
 * does not distinguish them — telling an unauthenticated caller which of the
 * two it was is itself a disclosure. So the question is asked of
 * `/v1/auth/me` first, which is answering about the caller's own session and
 * may therefore say.
 *
 * The regression pinned here: before the guard existed, an unauthenticated
 * visit threw the 401 straight through the render and Next answered **500** —
 * a stack trace where a sign-in screen belonged.
 */
const session = (next: AuthSession['next']): AuthSession =>
  ({
    user: { id: 'u1', fullName: 'Ramesh Kumar', email: 'owner@example.in' },
    dealer: null,
    next,
  }) as unknown as AuthSession;

const DEALER = {
  slug: 'sri-lakshmi-motors',
  status: 'ACTIVE',
  statusLabel: 'Active',
  brandName: 'Sri Lakshmi Motors',
  legalName: 'Sri Lakshmi Motors Pvt Ltd',
  creditBalance: 14,
  creditsHeld: 0,
};

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

const layout = () => DealerLayout({ children: <p>the profile screen</p> });

describe('the console guard', () => {
  it('sends a signed-out visitor to sign in, rather than throwing a 500', async () => {
    currentSession.mockResolvedValue(null);

    expect(await redirectOf(layout())).toBe('/dealer/login?error=session_expired');
    // And nothing was fetched with a session that does not exist.
    expect(apiGet).not.toHaveBeenCalled();
  });

  /**
   * The second visitor the 401 hides: signed in, but with no dealership yet.
   * There is no console to show until there is one, and the wizard is where
   * that gets fixed.
   */
  it('sends a dealer who has not finished onboarding to the wizard', async () => {
    currentSession.mockResolvedValue(session('ONBOARDING'));

    expect(await redirectOf(layout())).toBe('/dealer/onboarding');
    expect(apiGet).not.toHaveBeenCalled();
  });

  /** A 500 is still a 500 when it genuinely is one — this guard is not a mute. */
  it('does not swallow a failure that is not about the session', async () => {
    currentSession.mockRejectedValue(
      new ApiError({ type: 'about:blank', title: 'Internal', status: 500, code: 'INTERNAL' }),
    );

    await expect(layout()).rejects.toThrow(ApiError);
  });
});

describe('the console shell', () => {
  it('names the dealership, shows its status and its balance, and offers sign out', async () => {
    currentSession.mockResolvedValue(session('DASHBOARD'));
    apiGet.mockResolvedValue(DEALER);

    render(await layout());

    expect(apiGet).toHaveBeenCalledWith('/v1/dealer');
    expect(screen.getByText('Sri Lakshmi Motors')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('14 credits')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByText('the profile screen')).toBeInTheDocument();
  });

  /**
   * The dealership id is never in a URL below this layout and never in a
   * request from it — the API resolves it from the session (rule 1). Asserted
   * because the shell is the one place tempted to pass it down.
   */
  it('asks for the dealership without naming one', async () => {
    currentSession.mockResolvedValue(session('DASHBOARD'));
    apiGet.mockResolvedValue(DEALER);

    await layout();

    for (const [path] of apiGet.mock.calls as [string][]) {
      expect(path).not.toMatch(/dealerId|[0-9a-f]{8}-[0-9a-f]{4}/i);
    }
  });

  /**
   * Credits held against cars under review are a *subtraction* from a balance a
   * dealer would otherwise read as spendable, so the line appears only when
   * there is something to say.
   */
  it('says what is held only when something is held', async () => {
    currentSession.mockResolvedValue(session('DASHBOARD'));

    apiGet.mockResolvedValue(DEALER);
    const { unmount } = render(await layout());
    expect(screen.queryByText(/held for cars under review/i)).toBeNull();
    unmount();

    apiGet.mockResolvedValue({ ...DEALER, creditsHeld: 3 });
    render(await layout());
    expect(screen.getByText('3 held for cars under review')).toBeInTheDocument();
  });

  /**
   * A dealership that is not ACTIVE — under review, or suspended — reads its own
   * status off the top bar. The tone changes with it, and the label carries the
   * meaning either way: status is never colour alone (§4.15).
   */
  it('warns on the top bar when the dealership is not active', async () => {
    currentSession.mockResolvedValue(session('DASHBOARD'));
    apiGet.mockResolvedValue({ ...DEALER, status: 'PENDING', statusLabel: 'Under review' });

    render(await layout());

    expect(screen.getByText('Under review').className).toContain('tag-warn');
  });
});
