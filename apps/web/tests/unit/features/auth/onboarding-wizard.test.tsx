import type {
  AuthSession,
  CitiesResponse,
  CompletenessResponse,
  DealerDocumentDto,
} from '@dealers-drive/contracts';
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
 * **F038 adds the second describe block**, for the Account step, **F039 the
 * third**, for the Business step, **F041 the fourth**, for Documents, and
 * **F043 the fifth**, for the outstanding-items list. Their claims are of the
 * same kind: what a step refuses to ask for, and what it carries forward — not
 * how it is laid out.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** `GET /v1/dealer/completeness`, with everything outstanding named. */
function completeness(missing: Record<string, string[]> = {}): CompletenessResponse {
  const steps = (['account', 'business', 'documents', 'review'] as const).map((key) => ({
    key,
    label: key[0]!.toUpperCase() + key.slice(1),
    complete: (missing[key] ?? []).length === 0,
    missing: missing[key] ?? [],
  }));

  return {
    isComplete: steps.slice(0, 3).every((step) => step.complete),
    canSubmit: steps.slice(0, 3).every((step) => step.complete),
    percent: Math.round((steps.filter((step) => step.complete).length / 4) * 100),
    steps,
  };
}

/** One row of the KYC checklist, as `GET /v1/dealer/documents` returns it. */
function document(overrides: Partial<DealerDocumentDto> = {}): DealerDocumentDto {
  return {
    id: null,
    type: 'GST_CERTIFICATE',
    label: 'GST certificate',
    status: 'REQUIRED',
    statusLabel: 'Required — PDF or JPG, max 5 MB',
    fileName: null,
    uploadedAt: null,
    rejectionReason: null,
    action: 'Upload',
    ...overrides,
  };
}

/** The three rows the API always returns, all outstanding. */
const DOCUMENTS: DealerDocumentDto[] = [
  document(),
  document({ type: 'PAN_CARD', label: 'PAN card' }),
  document({ type: 'ADDRESS_PROOF', label: 'Address proof' }),
];

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
    render(
      <OnboardingWizard
        step={0}
        session={session()}
        cities={CITIES}
        documents={[]}
        dealer={null}
        completeness={null}
      />,
    );

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
    render(
      <OnboardingWizard
        step={step}
        session={session()}
        cities={CITIES}
        documents={[]}
        dealer={null}
        completeness={null}
      />,
    );
    expect(filledSteps()).toEqual([...expected]);
  });

  /**
   * The asymmetry that is the whole point of the component: Account and
   * Business submit together, so moving between them must not touch the
   * server. A navigation here would cost the dealer everything they had typed.
   */
  it('moves Account → Business in the browser, with no navigation', async () => {
    const user = userEvent.setup();
    render(
      <OnboardingWizard
        step={0}
        session={session()}
        cities={CITIES}
        documents={[]}
        dealer={null}
        completeness={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(filledSteps()).toEqual(['Account', 'Business']);
    expect(navigationState.pushed).toEqual([]);
  });

  it('moves Business → Account on Back, with no navigation', async () => {
    const user = userEvent.setup();
    render(
      <OnboardingWizard
        step={1}
        session={session()}
        cities={CITIES}
        documents={[]}
        dealer={null}
        completeness={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(filledSteps()).toEqual(['Account']);
    expect(navigationState.pushed).toEqual([]);
  });

  /** There is nothing behind step 1, so Back leaves onboarding altogether. */
  it('leaves onboarding for sign-in on Back from Account', async () => {
    const user = userEvent.setup();
    render(
      <OnboardingWizard
        step={0}
        session={session()}
        cities={CITIES}
        documents={[]}
        dealer={null}
        completeness={null}
      />,
    );

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
    vi.mocked(apiGet).mockImplementation((path: string) => {
      if (path.startsWith('/v1/cities')) return Promise.resolve({ data: CITIES });
      if (path.startsWith('/v1/dealer/documents')) return Promise.resolve({ data: DOCUMENTS });
      if (path === '/v1/dealer') return Promise.resolve({ gstin: null, pan: null });
      if (path.startsWith('/v1/dealer/completeness')) return Promise.resolve(completeness());
      return Promise.resolve(sessionWith(dealer));
    });

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
    render(
      <OnboardingWizard
        step={0}
        session={session()}
        cities={CITIES}
        documents={[]}
        dealer={null}
        completeness={null}
      />,
    );

    const email = screen.getByLabelText('Email');
    expect(email).toHaveValue('karthik@srilakshmimotors.in');
    expect(email).toBeDisabled();
    expect(email).not.toHaveAttribute('name');
    expect(screen.getByText('Verified with Google')).toBeInTheDocument();
  });

  /** The identity is the verified one; `user.email` is only the fallback. */
  it('falls back to the account email when there is no linked identity', () => {
    render(
      <OnboardingWizard
        step={0}
        session={session({ identity: null })}
        cities={CITIES}
        documents={[]}
        dealer={null}
        completeness={null}
      />,
    );

    expect(screen.getByLabelText('Email')).toHaveValue('karthik@srilakshmimotors.in');
  });

  it('prefills the name from the Google profile when the user record has none', () => {
    render(
      <OnboardingWizard
        step={0}
        session={session()}
        cities={CITIES}
        documents={[]}
        dealer={null}
        completeness={null}
      />,
    );

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
        documents={[]}
        dealer={null}
        completeness={null}
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
    render(
      <OnboardingWizard
        step={0}
        session={session()}
        cities={CITIES}
        documents={[]}
        dealer={null}
        completeness={null}
      />,
    );

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
    render(
      <OnboardingWizard
        step={0}
        session={session()}
        cities={CITIES}
        documents={[]}
        dealer={null}
        completeness={null}
      />,
    );
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
    render(
      <OnboardingWizard
        step={1}
        session={session()}
        cities={CITIES}
        documents={[]}
        dealer={null}
        completeness={null}
      />,
    );

    expect(
      screen.getByLabelText('Dealership name (public)').closest('fieldset'),
    ).not.toHaveAttribute('hidden');
    expect(screen.getByLabelText('Full name').closest('fieldset')).toHaveAttribute('hidden');
  });
});

/**
 * F041 — step 3.
 *
 * This step is reached by navigation rather than locally, so the frame's
 * Back/Continue row is gone and the step brings its own. Two claims are worth
 * pinning: the checklist is a row per required document whatever their state,
 * and Continue says how many are still outstanding — a dealer may leave with
 * documents missing, and the button should not pretend otherwise.
 */
describe('OnboardingWizard — the Documents step', () => {
  function render_(documents: DealerDocumentDto[], dealer: { gstin?: string; pan?: string } = {}) {
    return render(
      <OnboardingWizard
        step={2}
        session={session({
          dealer: { id: 'd1', slug: 'a', brandName: 'A', status: 'DRAFT' } as never,
        })}
        cities={CITIES}
        documents={documents}
        dealer={dealer as never}
        completeness={null}
      />,
    );
  }

  it('renders one uploader per document, whatever its state', () => {
    render_(DOCUMENTS);

    // The file input carries the accessible name; the visible button opens it.
    for (const label of ['GST certificate', 'PAN card', 'Address proof']) {
      expect(screen.getByLabelText(`Upload ${label}`)).toHaveAttribute('type', 'file');
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  /** A dealer may leave with documents missing; the button says how many. */
  it('counts what is still outstanding on Continue', () => {
    render_(DOCUMENTS);

    expect(
      screen.getByRole('button', { name: 'Continue (3 still to upload)' }),
    ).toBeInTheDocument();
  });

  it('drops the count once nothing is outstanding', () => {
    render_(DOCUMENTS.map((row) => ({ ...row, status: 'UPLOADED' as const })));

    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  /**
   * Both controls navigate — the step is reached by a URL the server resolves,
   * so leaving it is a navigation too, not a local move.
   */
  it('moves on by navigation, whether you skip or continue', async () => {
    const user = userEvent.setup();
    render_(DOCUMENTS);

    await user.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(navigationState.pushed).toEqual(['/dealer/onboarding?step=3']);
  });

  /** GSTIN and PAN are a separate PATCH, so they save without leaving the step. */
  it('prefills the registrations from the dealership record', () => {
    render_(DOCUMENTS, { gstin: '33AABCS1429B1ZX', pan: 'AABCS1429B' });

    expect(screen.getByLabelText('GSTIN')).toHaveValue('33AABCS1429B1ZX');
    expect(screen.getByLabelText('PAN')).toHaveValue('AABCS1429B');
  });

  it('leaves the frame’s Back/Continue row behind', () => {
    render_(DOCUMENTS);

    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });
});

/**
 * F043 — what is still missing, in words.
 *
 * The API answers `POST /v1/auth/onboarding` and `POST /v1/dealer/submit` with
 * field keys: `gstin`, `GST_CERTIFICATE`, `cityId`. Those are precise, and they
 * are not what to put in front of somebody at the end of a sign-up form. The
 * banner translates them, and falls back to the raw key rather than dropping
 * anything it does not recognise — a blocker nobody can see is worse than an
 * ugly one.
 *
 * Reaching the banner needs a rejected submit, so this block stubs the action.
 */
vi.mock('@/features/auth/actions', () => ({
  onboardingAction: vi.fn(),
  saveBusinessIdsAction: vi.fn(() => Promise.resolve({})),
}));

describe('OnboardingWizard — the outstanding-items list', () => {
  /**
   * The blockers, read out of the banner rather than off the page. The Stepper
   * is a list too, and so is the city `<select>` — "City" appears three times
   * on this screen and only one of them is a blocker.
   */
  function blockersShown(): string[] {
    const banner = screen.getByRole('status');
    return [...banner.querySelectorAll('li')].map((item) => item.textContent ?? '');
  }

  /** Submits the two-step form and returns once the banner has rendered. */
  async function submitAndFail(state: object, blockers: CompletenessResponse | null) {
    const { onboardingAction } = await import('@/features/auth/actions');
    vi.mocked(onboardingAction).mockResolvedValue(state);

    const user = userEvent.setup();
    render(
      <OnboardingWizard
        step={1}
        session={session()}
        cities={CITIES}
        documents={[]}
        dealer={null}
        completeness={blockers}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    return user;
  }

  it('names each blocker in words a dealer can act on', async () => {
    await submitAndFail(
      { message: 'Some details are still missing.' },
      completeness({ business: ['gstin', 'cityId'], documents: ['GST_CERTIFICATE'] }),
    );

    expect(await screen.findByText('Some details are still missing.')).toBeInTheDocument();
    expect(blockersShown()).toEqual(['GSTIN', 'City', 'GST certificate']);
  });

  /** An unmapped key still reaches the dealer, ugly rather than invisible. */
  it('falls back to the raw key for anything it has no wording for', async () => {
    await submitAndFail(
      { message: 'Some details are still missing.' },
      completeness({ business: ['somethingNew'] }),
    );

    expect(await screen.findByText('somethingNew')).toBeInTheDocument();
    expect(blockersShown()).toEqual(['somethingNew']);
  });

  it('shows the message alone when nothing is outstanding', async () => {
    await submitAndFail({ message: 'That could not be saved.' }, completeness());

    expect(await screen.findByText('That could not be saved.')).toBeInTheDocument();
    expect(blockersShown()).toEqual([]);
  });

  it('shows nothing at all when the action did not fail', () => {
    render(
      <OnboardingWizard
        step={1}
        session={session()}
        cities={CITIES}
        documents={[]}
        dealer={null}
        completeness={completeness({ business: ['gstin'] })}
      />,
    );

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('GSTIN')).toBeNull();
  });
});
