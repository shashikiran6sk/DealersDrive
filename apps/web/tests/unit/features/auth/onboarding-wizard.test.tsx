import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { navigationState } from '../../../setup';

import type * as ApiModule from '@/lib/api';
import { ONBOARDING_STEPS, OnboardingWizard } from '@/features/auth/onboarding-wizard';

/**
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * **New, with no baseline equivalent.** `component-map.md` records that no
 * feature component has a test except the four marked ✅, and C040 is not one
 * of them — so this is a divergence from a faithful port, and worth the sentence
 * that justifies it.
 *
 * F037 is *only* step routing. There is no form, no field and no request; the
 * entire feature is the arithmetic that decides which of four steps a person
 * lands on, split across two files — a floor computed on the server from the
 * session, and local movement in the browser. That seam is the one thing here
 * that can be wrong without anything failing to compile, and it is the one
 * thing the later step features will assume rather than re-derive.
 *
 * What is asserted is therefore limited to behaviour that outlives this PR.
 * Nothing here pins the scaffolding: not the disabled Continue on Business
 * (**F039** replaces it with its form's submit), and not the absence of
 * controls on Documents and Review (**F041** and **F042** bring their own). A
 * test that fails when the next feature does its job is a tax, not a check.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Which step labels the Stepper has filled — `index <= current`, C015. */
function filledSteps(): string[] {
  return within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .filter((item) => (item.firstElementChild as HTMLElement).style.background.includes('accent'))
    .map((item) => item.textContent ?? '');
}

describe('OnboardingWizard — the frame', () => {
  it('names the four steps, in order', () => {
    render(<OnboardingWizard step={0} />);

    const labels = within(screen.getByRole('list'))
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(labels).toEqual([...ONBOARDING_STEPS]);
  });

  it.each([
    [0, ['Account']],
    [1, ['Account', 'Business']],
    [2, ['Account', 'Business', 'Documents']],
    [3, ['Account', 'Business', 'Documents', 'Review']],
  ] as const)('opens at the step the server resolved (%i)', (step, expected) => {
    render(<OnboardingWizard step={step} />);
    expect(filledSteps()).toEqual([...expected]);
  });

  /**
   * The asymmetry that is the whole point of the component: Account and
   * Business submit together, so moving between them must not touch the
   * server. A navigation here would cost the dealer everything they had typed.
   */
  it('moves Account → Business in the browser, with no navigation', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard step={0} />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(filledSteps()).toEqual(['Account', 'Business']);
    expect(navigationState.pushed).toEqual([]);
  });

  it('moves Business → Account on Back, with no navigation', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard step={1} />);

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(filledSteps()).toEqual(['Account']);
    expect(navigationState.pushed).toEqual([]);
  });

  /** There is nothing behind step 1, so Back leaves onboarding altogether. */
  it('leaves onboarding for sign-in on Back from Account', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard step={0} />);

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(navigationState.pushed).toEqual(['/dealer/login']);
  });
});

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('@/lib/api');
  return { ...actual, apiGet: vi.fn() };
});

/**
 * The other half of the seam. Which step a dealer *may* be on is not the
 * browser's decision — a `?step=` in the address bar must not walk somebody
 * back into a form whose answers are already committed, nor forward into one
 * that needs a dealership that does not exist yet.
 */
describe('OnboardingPage — the floor the server sets', () => {
  function sessionWith(dealer: { status: string } | null) {
    return {
      next: dealer ? 'DASHBOARD' : 'ONBOARDING',
      user: {},
      identity: {},
      dealer: dealer ? { id: 'd1', slug: 'a-dealer', brandName: 'A Dealer', ...dealer } : null,
      role: null,
      permissions: [],
      counts: { newEnquiries: 0, pendingListings: 0 },
    };
  }

  /** Renders the page and reports the step it opened on. */
  async function openedAt(dealer: { status: string } | null, step?: string): Promise<number> {
    const { apiGet } = await import('@/lib/api');
    vi.mocked(apiGet).mockResolvedValue(sessionWith(dealer));

    const { default: OnboardingPage } = await import('@/app/(auth)/dealer/onboarding/page');
    render(await OnboardingPage({ searchParams: Promise.resolve({ step }) }));

    return filledSteps().length - 1;
  }

  it('opens a brand-new account at Account', async () => {
    expect(await openedAt(null)).toBe(0);
  });

  it('opens a DRAFT dealership at Documents — steps 1 and 2 are behind it', async () => {
    expect(await openedAt({ status: 'DRAFT' })).toBe(2);
  });

  it('opens a submitted dealership at Review, and nowhere else', async () => {
    expect(await openedAt({ status: 'PENDING_APPROVAL' })).toBe(3);
  });

  it('refuses a ?step= below the floor', async () => {
    expect(await openedAt({ status: 'DRAFT' }, '0')).toBe(2);
  });

  it('clamps a ?step= past the last step', async () => {
    expect(await openedAt(null, '9')).toBe(3);
  });

  it('falls back to the floor when ?step= is not a number', async () => {
    expect(await openedAt({ status: 'DRAFT' }, 'nonsense')).toBe(2);
  });

  it('allows a ?step= forward of the floor — the wizard is not one-way', async () => {
    expect(await openedAt(null, '2')).toBe(2);
  });

  /** A dealership past onboarding has a console; this screen is not it. */
  it('sends an ACTIVE dealership to the console', async () => {
    await expect(openedAt({ status: 'ACTIVE' })).rejects.toThrow('NEXT_REDIRECT:/dealer');
  });
});
