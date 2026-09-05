import type {
  AuthSession,
  CompletenessResponse,
  DealerDocumentDto,
  YardPhotoDto,
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
 * third**, for the Business step, **F041 the fourth**, for Documents, **F043
 * the fifth**, for the outstanding-items list, and **F042 the sixth**, for
 * Review. Their claims are of the same kind: what a step refuses to ask for,
 * and what it carries forward — not how it is laid out.
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

/** `GET /v1/dealer/yard-photo` before anything has been uploaded. */
const NO_YARD_PHOTO: YardPhotoDto = {
  mediaId: null,
  status: null,
  fileName: null,
  url: null,
  uploadedAt: null,
};

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
      // A real number, because step 1 now refuses to advance without one and
      // nearly every test below walks through it.
      phone: '9840012345',
      phoneDisplay: '98400 12345',
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
        documents={[]}
        dealer={null}
        completeness={null}
        yardPhoto={null}
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
        documents={[]}
        dealer={null}
        completeness={null}
        yardPhoto={null}
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
        documents={[]}
        dealer={null}
        completeness={null}
        yardPhoto={null}
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
        documents={[]}
        dealer={null}
        completeness={null}
        yardPhoto={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(filledSteps()).toEqual(['Account']);
    expect(navigationState.pushed).toEqual([]);
  });

  /**
   * There is nothing behind step 1, so it offers no way back.
   *
   * The baseline's Back here went to `/dealer/login` — not a step of this
   * wizard, and a control that abandons the flow the dealer is halfway through.
   * Every *other* step has one, which is what makes its absence read as "this
   * is the beginning" rather than as an omission.
   */
  it('offers no Back on Account — it is the first step', () => {
    render(
      <OnboardingWizard
        step={0}
        session={session()}
        documents={[]}
        dealer={null}
        completeness={null}
        yardPhoto={null}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  /**
   * Step 1 refuses to advance on an empty required field.
   *
   * The server validates these too and is the only thing that counts — but its
   * verdict would not arrive until the dealer had filled in step 2 and pressed
   * Continue, which is four fields and a city later than the mistake.
   */
  it('refuses to leave Account while a required field is empty', async () => {
    const user = userEvent.setup();
    render(
      <OnboardingWizard
        step={0}
        session={session({ user: { phone: '' }, identity: { name: null } })}
        documents={[]}
        dealer={null}
        completeness={null}
        yardPhoto={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(filledSteps()).toEqual(['Account']);
    expect(screen.getByText('Tell us your name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a 10-digit Indian mobile number.')).toBeInTheDocument();
  });

  it('advances once the required fields are filled', async () => {
    const user = userEvent.setup();
    render(
      <OnboardingWizard
        step={0}
        session={session({ user: { phone: '' }, identity: { name: null } })}
        documents={[]}
        dealer={null}
        completeness={null}
        yardPhoto={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(filledSteps()).toEqual(['Account']);

    await user.type(screen.getByLabelText('Full name'), 'Karthik Raman');
    await user.type(screen.getByLabelText(/^Phone/), '9840012345');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(filledSteps()).toEqual(['Account', 'Business']);
  });

  /** A malformed number is refused as firmly as a missing one. */
  it('refuses a phone number that is not an Indian mobile', async () => {
    const user = userEvent.setup();
    render(
      <OnboardingWizard
        step={0}
        session={session({ user: { phone: '12345' } })}
        documents={[]}
        dealer={null}
        completeness={null}
        yardPhoto={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(filledSteps()).toEqual(['Account']);
    expect(screen.getByText('Enter a 10-digit Indian mobile number.')).toBeInTheDocument();
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
   * The page reads several endpoints — the session that sets the floor, and
   * the dealership-scoped four — so the stub answers by path rather than
   * returning one body for everything.
   */
  async function openedAt(dealer: { status: string } | null, step?: string): Promise<number> {
    const { apiGet } = await import('@/lib/api');
    vi.mocked(apiGet).mockImplementation((path: string) => {
      if (path.startsWith('/v1/dealer/documents')) return Promise.resolve({ data: DOCUMENTS });
      if (path === '/v1/dealer') {
        // Enough of `DealerProfile` for steps 1 and 2 to prefill from: they
        // amend an existing dealership now rather than only creating one.
        return Promise.resolve({
          legalName: 'A Dealer',
          gstin: null,
          pan: null,
          contact: { fullName: null, roleTitle: null, phone: '9840012345', landline: null },
          address: { line: null, city: null, state: null, pincode: null },
        });
      }
      if (path.startsWith('/v1/dealer/completeness')) return Promise.resolve(completeness());
      if (path.startsWith('/v1/dealer/yard-photo')) return Promise.resolve(NO_YARD_PHOTO);
      return Promise.resolve(sessionWith(dealer));
    });

    const { default: OnboardingPage } = await import('@/app/(auth)/dealer/onboarding/page');
    render(await OnboardingPage({ searchParams: Promise.resolve({ step }) }));

    return filledSteps().length - 1;
  }

  it('opens a brand-new account at Account', async () => {
    expect(await openedAt(null)).toBe(0);
  });

  it('lands a DRAFT dealership on Documents — the step it had reached', async () => {
    expect(await openedAt({ status: 'DRAFT' })).toBe(2);
  });

  it('opens a submitted dealership at Review, and nowhere else', async () => {
    expect(await openedAt({ status: 'PENDING_APPROVAL' })).toBe(3);
  });

  /**
   * Where it lands and how far back it goes are two different questions.
   *
   * The floor used to be 2 once a dealership existed, on the reasoning that
   * steps 1 and 2 *create* it and so are behind you. True of the write, false
   * of the dealer: a name typed wrong could not be corrected without an admin,
   * and step 3's Back button pointed at a step the server would bounce them
   * off. Steps 1 and 2 amend as readily as they create now, so a DRAFT
   * dealership may walk back to either.
   */
  it('lets a DRAFT dealership walk back to Account', async () => {
    expect(await openedAt({ status: 'DRAFT' }, '0')).toBe(0);
  });

  it('lets a DRAFT dealership walk back to Business', async () => {
    expect(await openedAt({ status: 'DRAFT' }, '1')).toBe(1);
  });

  /** A submitted dealership is the one thing that has nothing left to edit. */
  it('refuses a ?step= below the floor once submitted', async () => {
    expect(await openedAt({ status: 'PENDING_APPROVAL' }, '1')).toBe(3);
  });

  it('clamps a ?step= past the last step', async () => {
    expect(await openedAt(null, '9')).toBe(3);
  });

  it('falls back to the landing step when ?step= is not a number', async () => {
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
        documents={[]}
        dealer={null}
        completeness={null}
        yardPhoto={null}
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
        documents={[]}
        dealer={null}
        completeness={null}
        yardPhoto={null}
      />,
    );

    expect(screen.getByLabelText('Email')).toHaveValue('karthik@srilakshmimotors.in');
  });

  it('prefills the name from the Google profile when the user record has none', () => {
    render(
      <OnboardingWizard
        step={0}
        session={session()}
        documents={[]}
        dealer={null}
        completeness={null}
        yardPhoto={null}
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
        documents={[]}
        dealer={null}
        completeness={null}
        yardPhoto={null}
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
        documents={[]}
        dealer={null}
        completeness={null}
        yardPhoto={null}
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
 * Two claims here outlive the layout. City and state are typed, not chosen:
 * they were a five-row dropdown and a disabled box beside it, which decided
 * which dealerships could exist rather than describing the ones that do. And
 * Continue on this step is the submit — one form across two screens, sending
 * every field at once, which is what keeps a half-finished sign-up from
 * leaving a half-made tenant behind.
 */
describe('OnboardingWizard — the Business step', () => {
  /** Moves to step 2 the way a dealer does, and returns the user-event handle. */
  async function onBusinessStep() {
    const user = userEvent.setup();
    render(
      <OnboardingWizard
        step={0}
        session={session()}
        documents={[]}
        dealer={null}
        completeness={null}
        yardPhoto={null}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    return user;
  }

  /**
   * The reach of the product used to be a database migration: five towns in
   * one state, and a dealer outside them could not finish this form at all.
   */
  it('asks for the city and the state as text, both required', async () => {
    await onBusinessStep();

    const city = screen.getByLabelText('City');
    const state = screen.getByLabelText('State');

    for (const field of [city, state]) {
      expect(field.tagName).toBe('INPUT');
      expect(field).toBeEnabled();
      expect(field).toBeRequired();
    }
    expect(city).toHaveAttribute('name', 'city');
    expect(state).toHaveAttribute('name', 'state');
  });

  it('takes a city and a state the platform has never seen before', async () => {
    const user = await onBusinessStep();

    await user.type(screen.getByLabelText('City'), 'Hubballi');
    await user.type(screen.getByLabelText('State'), 'Karnataka');

    expect(screen.getByLabelText('City')).toHaveValue('Hubballi');
    expect(screen.getByLabelText('State')).toHaveValue('Karnataka');
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
    expect(form?.querySelector('#legalName')).not.toBeNull();
    // One name, not two — `brandName` is the server's mirror of it.
    expect(form?.querySelector('#brandName')).toBeNull();
  });

  it('keeps its fields in the form when Back returns to Account', async () => {
    const user = await onBusinessStep();

    await user.click(screen.getByRole('button', { name: 'Back' }));

    const legalName = screen.getByLabelText(/^Dealership name/);
    expect(legalName.closest('fieldset')).toHaveAttribute('hidden');
    expect(navigationState.pushed).toEqual([]);
  });

  /**
   * One name, asked for once.
   *
   * The baseline asked for a public brand name and a registered legal name side
   * by side, and dealers filled both in with the same words. `brandName` is now
   * the server's display mirror of `legalName` and is not a field at all.
   */
  it('asks for one dealership name, the registered one', async () => {
    await onBusinessStep();

    expect(screen.getByLabelText(/^Dealership name/)).toHaveAttribute('name', 'legalName');
    expect(screen.queryByLabelText('Registered legal name')).toBeNull();
    expect(screen.queryByLabelText('Dealership name (public)')).toBeNull();
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
        documents={[]}
        dealer={null}
        completeness={null}
        yardPhoto={null}
      />,
    );

    expect(screen.getByLabelText(/^Dealership name/).closest('fieldset')).not.toHaveAttribute(
      'hidden',
    );
    expect(screen.getByLabelText('Full name').closest('fieldset')).toHaveAttribute('hidden');
  });
});

/**
 * F041 — step 3.
 *
 * This step is reached by navigation rather than locally, so the frame's
 * Back/Continue row is gone and the step brings its own. Three claims are worth
 * pinning: the checklist is a row per required document whatever their state,
 * the yard photograph sits alongside them, and **Continue does not move while
 * anything is outstanding**.
 *
 * That last one replaces a "Skip for now" and a Continue that merely *counted*
 * what was missing. Both let a dealer walk to the end of the wizard and only
 * there be told what they had skipped — the same information, three screens
 * too late. What counts as outstanding is the server's `completeness` answer,
 * because it is the same derivation `POST /v1/dealer/submit` refuses on.
 */
describe('OnboardingWizard — the Documents step', () => {
  function render_(
    documents: DealerDocumentDto[],
    dealer: { gstin?: string; pan?: string } = {},
    blockers: CompletenessResponse | null = completeness(),
    photo: YardPhotoDto = NO_YARD_PHOTO,
  ) {
    return render(
      <OnboardingWizard
        step={2}
        session={session({
          dealer: { id: 'd1', slug: 'a', brandName: 'A', status: 'DRAFT' } as never,
        })}
        documents={documents}
        dealer={dealer as never}
        completeness={blockers}
        yardPhoto={photo}
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

  /**
   * The yard photograph is on this step because it is where a dealer uploads
   * things, and it is required for a different reason from the three beside it:
   * it fronts the public portfolio rather than being read once by a moderator.
   */
  it('asks for a photo of the yard, and says what it is for', () => {
    render_(DOCUMENTS);

    expect(screen.getByLabelText('Upload a photo of your yard')).toHaveAttribute('type', 'file');
    expect(screen.getByText(/first thing buyers see/)).toBeInTheDocument();
    expect(screen.getByText(/clear, well-lit photograph of your yard/)).toBeInTheDocument();
  });

  it('shows the photo back once one has been uploaded', () => {
    render_(DOCUMENTS, {}, completeness(), {
      mediaId: '00000000-0000-4000-8000-00000000000a',
      status: 'PENDING',
      fileName: 'yard.jpg',
      url: 'https://storage.example/signed/yard.jpg',
      uploadedAt: '2026-09-04T00:00:00.000Z',
    });

    expect(screen.getByAltText('The dealership yard, as buyers will see it')).toHaveAttribute(
      'src',
      'https://storage.example/signed/yard.jpg',
    );
    expect(screen.getByRole('button', { name: 'Replace photo' })).toBeInTheDocument();
  });

  /** Nothing outstanding, so the step moves on — by navigation, as it is reached. */
  it('continues by navigation once nothing is outstanding', async () => {
    const user = userEvent.setup();
    render_(DOCUMENTS);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(navigationState.pushed).toEqual(['/dealer/onboarding?step=3']);
  });

  it('holds Continue while anything is still outstanding', () => {
    render_(DOCUMENTS, {}, completeness({ documents: ['GST_CERTIFICATE', 'YARD_PHOTO'] }));

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  /** And says what, rather than leaving the dealer to guess at a dead button. */
  it('names what is still outstanding, in words', () => {
    render_(
      DOCUMENTS,
      {},
      completeness({ business: ['gstin'], documents: ['PAN_CARD', 'YARD_PHOTO'] }),
    );

    const banner = screen.getByRole('status');
    expect([...banner.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      'PAN card',
      'Photo of your yard',
      'GSTIN',
    ]);
  });

  /** There is no way to skip past it any more, because there was never a step after. */
  it('offers no way to skip the step', () => {
    render_(DOCUMENTS, {}, completeness({ documents: ['GST_CERTIFICATE'] }));

    expect(screen.queryByRole('button', { name: 'Skip for now' })).toBeNull();
  });

  /** GSTIN and PAN are a separate PATCH, so they save without leaving the step. */
  it('prefills the registrations from the dealership record', () => {
    render_(DOCUMENTS, { gstin: '33AABCS1429B1ZX', pan: 'AABCS1429B' });

    expect(screen.getByLabelText('GSTIN')).toHaveValue('33AABCS1429B1ZX');
    expect(screen.getByLabelText('PAN')).toHaveValue('AABCS1429B');
  });

  /**
   * Every step but the first goes back. This one's Back is a navigation rather
   * than a local move, because the step it returns to re-reads the dealership.
   */
  it('goes back to Business by navigation', async () => {
    const user = userEvent.setup();
    render_(DOCUMENTS);

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigationState.pushed).toEqual(['/dealer/onboarding?step=1']);
  });
});

/**
 * F043 — what is still missing, in words.
 *
 * The API answers `POST /v1/auth/onboarding` and `POST /v1/dealer/submit` with
 * field keys: `gstin`, `GST_CERTIFICATE`, `city`. Those are precise, and they
 * are not what to put in front of somebody at the end of a sign-up form. The
 * banner translates them, and falls back to the raw key rather than dropping
 * anything it does not recognise — a blocker nobody can see is worse than an
 * ugly one.
 *
 * Reaching the banner needs a rejected submit, so this block stubs the action.
 */
vi.mock('@/features/auth/actions', () => ({
  onboardingAction: vi.fn(),
  updateOnboardingAction: vi.fn(),
  saveBusinessIdsAction: vi.fn(() => Promise.resolve({})),
  submitForVerificationAction: vi.fn(() => Promise.resolve({})),
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
        documents={[]}
        dealer={null}
        completeness={blockers}
        yardPhoto={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    return user;
  }

  it('names each blocker in words a dealer can act on', async () => {
    await submitAndFail(
      { message: 'Some details are still missing.' },
      completeness({ business: ['gstin', 'city'], documents: ['GST_CERTIFICATE'] }),
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
        documents={[]}
        dealer={null}
        completeness={completeness({ business: ['gstin'] })}
        yardPhoto={null}
      />,
    );

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('GSTIN')).toBeNull();
  });
});

/**
 * F042 — step 4.
 *
 * The step renders two different screens off one prop. Before the submit it is
 * a call to action; after it, an "under review" panel with no way back into the
 * form — because there is nothing left to change, and offering a Back button
 * that leads to an uneditable dealership would be a lie.
 *
 * Which of the two shows is decided by `session.dealer.status`, not by local
 * state: the page re-reads the session on every load, so a dealer who refreshes
 * after submitting sees the panel rather than the button they already pressed.
 */
describe('OnboardingWizard — the Review step', () => {
  function render_(status: 'DRAFT' | 'PENDING_APPROVAL', blockers: CompletenessResponse | null) {
    return render(
      <OnboardingWizard
        step={3}
        session={session({
          dealer: {
            id: 'd1',
            slug: 'katpadi-auto',
            brandName: 'Katpadi Auto Gallery',
            status,
          } as never,
        })}
        documents={[]}
        dealer={null}
        completeness={blockers}
        yardPhoto={null}
      />,
    );
  }

  it('offers the submit while the dealership is still a draft', () => {
    render_('DRAFT', completeness());

    expect(screen.getByRole('button', { name: 'Submit for verification' })).toBeEnabled();
    expect(screen.getByText('Ready to submit')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
      'href',
      '/dealer/onboarding?step=2',
    );
  });

  /**
   * Once submitted there is nothing to submit again, and nothing to go back to
   * — so both controls are replaced by the one thing left to do.
   */
  it('replaces the form with an under-review panel once submitted', () => {
    render_('PENDING_APPROVAL', completeness());

    expect(screen.queryByRole('button', { name: 'Submit for verification' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back' })).toBeNull();
    expect(screen.getByText('Under review')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute(
      'href',
      '/dealer',
    );
  });

  /** The panel names the dealership, so it reads as being about *them*. */
  it('names the dealership in the under-review copy', () => {
    render_('PENDING_APPROVAL', completeness());

    expect(screen.getByText(/Katpadi Auto Gallery/)).toBeInTheDocument();
  });

  it('promises a decision, and says what publishing still needs', () => {
    render_('DRAFT', completeness());

    expect(screen.getByText(/keep adding vehicles in the meantime/)).toBeInTheDocument();
    expect(screen.getByText(/one listing credit/)).toBeInTheDocument();
  });

  /**
   * A refused submit lists the same blockers the banner on step 2 does — the
   * API decides with the same derivation the wizard reads, so the two can only
   * be wrong together.
   */
  it('names what is outstanding when the API refuses the submit', async () => {
    const { submitForVerificationAction } = await import('@/features/auth/actions');
    vi.mocked(submitForVerificationAction).mockResolvedValue({
      message: 'Some details are still missing.',
    });

    const user = userEvent.setup();
    render_('DRAFT', completeness({ documents: ['ADDRESS_PROOF'], business: ['pan'] }));

    await user.click(screen.getByRole('button', { name: 'Submit for verification' }));

    expect(await screen.findByText('Some details are still missing.')).toBeInTheDocument();
    const banner = screen.getByRole('status');
    expect([...banner.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      'PAN',
      'Address proof',
    ]);
  });
});
