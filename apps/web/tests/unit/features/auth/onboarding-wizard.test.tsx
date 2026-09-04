import type { AuthSession, CitiesResponse } from '@dealers-drive/contracts';
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
 *
 * **F038 adds the second describe block**, for the Account step, and **F039
 * the third**, for the Business step. Their claims are of the same kind: what
 * a step refuses to ask for, and what it carries forward — not how it is laid
 * out.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * `GET /v1/cities` as the Business step sees it. The `all` row is the one that
 * matters here: it is a *search filter*, not a place a dealership can be, and
 * the step has to drop it.
 */
const CITIES: CitiesResponse['data'] = [
  { slug: 'all', name: 'All of Tamil Nadu', count: 412 },
  { slug: 'vellore', name: 'Vellore', state: 'Tamil Nadu', count: 88 },
  { slug: 'chennai', name: 'Chennai', state: 'Tamil Nadu', count: 210 },
];

/**
 * A session for a Google account that has signed in and has no dealership yet
 * — the state every dealer passes through, and the only one step 1 is rendered
 * in. `overrides` reaches `user` and `identity`, which is where every
 * assertion in the Account block looks.
 */
function session(
  overrides: {
    user?: Partial<AuthSession['user']>;
    identity?: Partial<AuthSession['identity']> | null;
    dealer?: AuthSession['dealer'];
  } = {},
): AuthSession {
  return {
    next: 'ONBOARDING',
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      fullName: null,
      roleTitle: null,
      phone: '',
      phoneDisplay: '',
      email: 'karthik@srilakshmimotors.in',
      emailVerified: true,
      ...overrides.user,
    },
    identity:
      overrides.identity === null
        ? null
        : {
            provider: 'GOOGLE',
            email: 'karthik@srilakshmimotors.in',
            name: 'Karthik Raman',
            pictureUrl: null,
            ...overrides.identity,
          },
    dealer: overrides.dealer ?? null,
    role: null,
    permissions: [],
    counts: { newEnquiries: 0, pendingListings: 0 },
  };
}

/** Which step labels the Stepper has filled — `index <= current`, C015. */
function filledSteps(): string[] {
  return within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .filter((item) => (item.firstElementChild as HTMLElement).style.background.includes('accent'))
    .map((item) => item.textContent ?? '');
}

describe('OnboardingWizard — the frame', () => {
  it('names the four steps, in order', () => {
    render(<OnboardingWizard step={0} session={session()} cities={CITIES} />);

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
    render(<OnboardingWizard step={step} session={session()} cities={CITIES} />);
    expect(filledSteps()).toEqual([...expected]);
  });

  /**
   * The asymmetry that is the whole point of the component: Account and
   * Business submit together, so moving between them must not touch the
   * server. A navigation here would cost the dealer everything they had typed.
   */
  it('moves Account → Business in the browser, with no navigation', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard step={0} session={session()} cities={CITIES} />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(filledSteps()).toEqual(['Account', 'Business']);
    expect(navigationState.pushed).toEqual([]);
  });

  it('moves Business → Account on Back, with no navigation', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard step={1} session={session()} cities={CITIES} />);

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(filledSteps()).toEqual(['Account']);
    expect(navigationState.pushed).toEqual([]);
  });

  /** There is nothing behind step 1, so Back leaves onboarding altogether. */
  it('leaves onboarding for sign-in on Back from Account', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard step={0} session={session()} cities={CITIES} />);

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

  /**
   * Renders the page and reports the step it opened on.
   *
   * The page reads two endpoints now — the session that sets the floor, and
   * `/v1/cities` for the Business step — so the stub answers by path rather
   * than returning one body for everything.
   */
  async function openedAt(dealer: { status: string } | null, step?: string): Promise<number> {
    const { apiGet } = await import('@/lib/api');
    vi.mocked(apiGet).mockImplementation((path: string) =>
      Promise.resolve(path.startsWith('/v1/cities') ? { data: CITIES } : sessionWith(dealer)),
    );

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

/**
 * F038 — step 1.
 *
 * Two things here are worth a test and the rest is layout. The email is
 * *shown, never asked for*: Google proved it, and an editable field would be a
 * way to claim an address nobody verified. And what the dealer typed survives a
 * rejection — the action echoes `values` back precisely so a bad pincode on
 * step 2 does not blank the four fields on step 1.
 */
describe('OnboardingWizard — the Account step', () => {
  it('shows the Google address as a read-only verified field, never an input to fill', () => {
    render(<OnboardingWizard step={0} session={session()} cities={CITIES} />);

    const email = screen.getByLabelText('Email');
    expect(email).toHaveValue('karthik@srilakshmimotors.in');
    expect(email).toBeDisabled();
    expect(email).not.toHaveAttribute('name');
    expect(screen.getByText('Verified with Google')).toBeInTheDocument();
  });

  /** The identity is the verified one; `user.email` is only the fallback. */
  it('falls back to the account email when there is no linked identity', () => {
    render(<OnboardingWizard step={0} session={session({ identity: null })} cities={CITIES} />);

    expect(screen.getByLabelText('Email')).toHaveValue('karthik@srilakshmimotors.in');
  });

  it('prefills the name from the Google profile when the user record has none', () => {
    render(<OnboardingWizard step={0} session={session()} cities={CITIES} />);

    expect(screen.getByLabelText('Full name')).toHaveValue('Karthik Raman');
  });

  it('prefers what the user record already holds over the Google profile', () => {
    render(
      <OnboardingWizard
        step={0}
        session={session({
          user: { fullName: 'K. Raman', roleTitle: 'Proprietor', phone: '9840012345' },
        })}
        cities={CITIES}
      />,
    );

    expect(screen.getByLabelText('Full name')).toHaveValue('K. Raman');
    expect(screen.getByLabelText(/^Role/)).toHaveValue('Proprietor');
    expect(screen.getByLabelText(/^Phone/)).toHaveValue('9840012345');
  });

  /**
   * The step stays mounted when the wizard moves to Business — it is one form
   * across two screens, so its fields have to still be in the FormData that
   * Continue submits. `hidden` is what makes that invisible rather than absent.
   */
  it('keeps its fields in the form when the wizard moves on to Business', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard step={0} session={session()} cities={CITIES} />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const fullName = screen.getByLabelText('Full name');
    expect(fullName).toBeInTheDocument();
    expect(fullName.closest('fieldset')).toHaveAttribute('hidden');
    expect(fullName.closest('form')).not.toBeNull();
  });
});

/**
 * F039 — step 2.
 *
 * Three claims here outlive the layout. The city list is not the city list the
 * search page gets: `/v1/cities` leads with an "All of Tamil Nadu" row, which
 * is a filter and not a place a dealership can be. The state is derived from
 * the city rather than typed, so the two cannot disagree. And Continue on this
 * step is the submit — one form across two screens, sending all nine fields at
 * once, which is what keeps a half-finished sign-up from leaving a half-made
 * tenant behind.
 */
describe('OnboardingWizard — the Business step', () => {
  /** Moves to step 2 the way a dealer does, and returns the user-event handle. */
  async function onBusinessStep() {
    const user = userEvent.setup();
    render(<OnboardingWizard step={0} session={session()} cities={CITIES} />);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    return user;
  }

  it('offers real cities only — the "all" pseudo-city is a filter, not a place', async () => {
    await onBusinessStep();

    const options = within(screen.getByLabelText('City'))
      .getAllByRole('option')
      .map((option) => option.textContent);

    expect(options).toEqual(['Select a city', 'Vellore', 'Chennai']);
  });

  it('derives the state from the chosen city rather than asking for it', async () => {
    const user = await onBusinessStep();

    const state = screen.getByLabelText('State');
    expect(state).toBeDisabled();
    expect(state).not.toHaveAttribute('name');

    await user.selectOptions(screen.getByLabelText('City'), 'chennai');
    expect(state).toHaveValue('Tamil Nadu');
  });

  /**
   * The submit lives here and nowhere else. Both fieldsets are inside it, so
   * the account fields typed on step 1 are still in the FormData that creates
   * the dealership.
   */
  it('makes Continue the submit that creates the dealership', async () => {
    await onBusinessStep();

    const submit = screen.getByRole('button', { name: 'Continue' });
    expect(submit).toHaveAttribute('type', 'submit');
    expect(submit).toBeEnabled();

    const form = submit.closest('form');
    expect(form?.querySelector('#fullName')).not.toBeNull();
    expect(form?.querySelector('#brandName')).not.toBeNull();
  });

  it('keeps its fields in the form when Back returns to Account', async () => {
    const user = await onBusinessStep();

    await user.click(screen.getByRole('button', { name: 'Back' }));

    const brandName = screen.getByLabelText('Dealership name (public)');
    expect(brandName.closest('fieldset')).toHaveAttribute('hidden');
    expect(navigationState.pushed).toEqual([]);
  });

  /**
   * `step={1}` is not a state the server ever produces — the floor is 0 until a
   * dealership exists and 2 once one does — but the wizard has to honour it,
   * because that is how it re-opens on Business after a rejected submit.
   */
  it('opens directly on Business when the frame is given step 1', () => {
    render(<OnboardingWizard step={1} session={session()} cities={CITIES} />);

    expect(
      screen.getByLabelText('Dealership name (public)').closest('fieldset'),
    ).not.toHaveAttribute('hidden');
    expect(screen.getByLabelText('Full name').closest('fieldset')).toHaveAttribute('hidden');
  });
});
