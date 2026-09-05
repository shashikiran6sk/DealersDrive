import type {
  AuthSession,
  CompletenessResponse,
  DealerDocumentDto,
  DealerProfile,
  YardPhotoDto,
} from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { authActionStub } from '../../mocks/auth-actions';

import { AuthShell } from '@/components/auth/auth-shell';
import { ONBOARDING_STEPS, OnboardingWizard } from '@/features/auth/onboarding-wizard';

/**
 * DESIGN-SPEC §3.10 — the onboarding wizard (C040).
 *
 * F037 landed the frame — which step is current, how a step is reached and the
 * progress indicator. **F038 lands step 1, F039 step 2, F041 step 3, F043 the
 * outstanding-items list and F042 step 4** — with which the wizard is complete.
 *
 * `step` is the *server's* answer, not a preference. The page computes a floor
 * from the session and clamps `?step=` into it, so the control below stands in
 * for a session state rather than for a click. The floor is 0 for a DRAFT
 * dealership and 3 for one already submitted: every step but the first goes
 * back, which is why steps 1 and 2 have a second write path (`PATCH
 * /v1/dealer`) behind the same fields.
 *
 * The wizard calls `useRouter().push` on Back from step 1, which needs the App
 * Router mock — hence `nextjs.appDirectory`. Without it the story throws on
 * that click rather than on render, which is the slower kind of failure to
 * find. It also calls `onboardingAction`, a Server Action, which the sandbox
 * aliases to `src/mocks/auth-actions.ts` (coupling C-4).
 */

/** `GET /v1/dealer/yard-photo` with nothing uploaded — step 3's hero slot. */
const NO_YARD_PHOTO: YardPhotoDto = {
  mediaId: null,
  status: null,
  fileName: null,
  url: null,
  uploadedAt: null,
};

/** One row of the KYC checklist. `DocumentUploader` has its own stories; these place it in context. */
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

const DOCUMENTS: DealerDocumentDto[] = [
  document(),
  document({ type: 'PAN_CARD', label: 'PAN card' }),
  document({ type: 'ADDRESS_PROOF', label: 'Address proof' }),
];

/**
 * `GET /v1/dealer/completeness`. The wizard renders `missing` as words rather
 * than as the field keys the API answers with — `gstin` becomes GSTIN,
 * `GST_CERTIFICATE` becomes GST certificate — which is the whole of what the
 * blocker-list stories are for.
 */
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

/**
 * A signed-in Google account. `dealer` is null for steps 1 and 2 — no
 * dealership exists yet — and set for steps 3 and 4, where its `status` is what
 * decides whether the Review step offers a submit or an under-review panel.
 */
function session(
  overrides: Partial<AuthSession['user']> = {},
  dealer: AuthSession['dealer'] = null,
) {
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
      ...overrides,
    },
    identity: {
      provider: 'GOOGLE',
      email: 'karthik@srilakshmimotors.in',
      name: 'Karthik Raman',
      pictureUrl: null,
    },
    dealer,
    role: null,
    permissions: [],
    counts: { newEnquiries: 0, pendingListings: 0 },
  } satisfies AuthSession;
}

const meta = {
  title: 'Forms/OnboardingWizard',
  component: OnboardingWizard,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <div style={{ minHeight: '100dvh', background: '#fff' }}>
        <AuthShell>
          <Story />
        </AuthShell>
      </div>
    ),
  ],
  argTypes: {
    step: {
      control: 'inline-radio',
      options: [0, 1, 2, 3],
      description: 'The floor the server resolved from the session.',
    },
    session: { control: false, description: 'GET /v1/auth/me. Step 1 is the only reader.' },
    documents: { control: false, description: 'GET /v1/dealer/documents. Step 3 only.' },
    dealer: {
      control: false,
      description: 'GET /v1/dealer. Prefills steps 1–2 on the way back, and GSTIN/PAN on step 3.',
    },
    completeness: {
      control: false,
      description: 'GET /v1/dealer/completeness. Read by the error banner and step 3s Continue.',
    },
    yardPhoto: { control: false, description: 'GET /v1/dealer/yard-photo. Step 3 only.' },
  },
  args: {
    step: 0,
    session: session(),
    documents: DOCUMENTS,
    dealer: null,
    completeness: null,
    yardPhoto: NO_YARD_PHOTO,
  },
  beforeEach: () => {
    authActionStub.result = {};
    authActionStub.delayMs = 900;
    authActionStub.calls.length = 0;
  },
} satisfies Meta<typeof OnboardingWizard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * Step 1 — where a Google account with no dealership always lands, with nothing
 * on the user record yet. Name comes from the Google profile; phone is blank,
 * because Google does not supply one.
 *
 * Back leaves onboarding altogether rather than moving within it, because
 * there is nothing behind step 1. That is the one navigation on this screen
 * that is not a step change.
 */
export const Account: Story = { args: { step: 0 } };

/**
 * The same step for somebody returning: the user record already holds a name,
 * a role and a phone, and those win over the Google profile. The email does
 * not change either way — it is shown, not asked for.
 */
export const AccountPrefilled: Story = {
  args: {
    step: 0,
    session: session({ fullName: 'K. Raman', roleTitle: 'Proprietor', phone: '9840012345' }),
  },
};

/**
 * Step 2. Passing `step={1}` is the same picture a dealer reaches by clicking
 * Continue on step 1, but it is not a state the server ever produces — the
 * floor is 0 until a dealership exists and 2 once one does, so 1 is only ever
 * arrived at locally, or re-opened after a rejected submit.
 *
 * City and State are typed, not chosen. They were a five-row dropdown and a
 * disabled box beside it, which decided which dealerships could exist rather
 * than describing the ones that do — a dealer in Salem could not finish this
 * form, and one in Bengaluru could not be described by it.
 *
 * The city is load-bearing beyond the address: a dealership's name has to be
 * unique **within its city**, so both halves of that pair are on this step and
 * the check is the submit. `BusinessNameTaken` below is that refusal.
 *
 * Continue here is the submit. Press it to watch the ~1s "Creating your
 * dealership…" state — nothing is written before that press, which is why a
 * dealer who abandons on step 1 leaves no half-made tenant behind.
 */
export const Business: Story = { args: { step: 1 } };

/**
 * What a rejected submit looks like. The action answers with a banner and
 * per-field messages, and echoes `values` back so the other eight fields
 * survive — press Continue to see it.
 */
export const BusinessFieldErrors: Story = {
  args: { step: 1 },
  beforeEach: () => {
    authActionStub.delayMs = 400;
    authActionStub.result = {
      message: 'That could not be saved.',
      errors: {
        legalName: 'Enter your dealership’s registered name.',
        pincode: 'Pincode must be 6 digits.',
        phone: 'Enter a 10-digit Indian mobile number.',
      },
    };
  },
};

/**
 * The duplicate-name refusal, which is what the city on this step is really
 * for. Press Continue.
 *
 * Two things to look at. The message names the town — the name on its own is
 * not the problem, and "Sri Balaji Motors" is a name three unrelated families
 * use in three different towns. And the banner carries no bullet list under
 * it: a refusal that already names a field is marked against that field, and
 * following it with unrelated outstanding items would read as if those were
 * the problem.
 */
export const BusinessNameTaken: Story = {
  args: {
    step: 1,
    completeness: completeness({ business: ['gstin', 'pan'] }),
  },
  beforeEach: () => {
    authActionStub.delayMs = 400;
    authActionStub.result = {
      message: 'A dealership called Sri Lakshmi Motors is already registered in Vellore.',
      errors: { legalName: 'Already registered in Vellore.' },
    };
  },
};

/**
 * The blocker list, which is the point of F043. Press Continue: the action
 * fails, and the banner names each outstanding item in words rather than in the
 * field keys the API answers with.
 *
 * Many blockers — the case that has to stay readable, because it is the one a
 * dealer who abandoned halfway comes back to.
 */
export const BlockersMany: Story = {
  args: {
    step: 1,
    completeness: completeness({
      account: ['phone'],
      business: ['gstin', 'pan', 'city', 'state', 'pincode'],
      documents: ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF'],
    }),
  },
  beforeEach: () => {
    authActionStub.delayMs = 400;
    authActionStub.result = { message: 'Some details are still missing.' };
  },
};

/** One blocker. Press Continue. */
export const BlockersOne: Story = {
  args: { step: 1, completeness: completeness({ documents: ['ADDRESS_PROOF'] }) },
  beforeEach: () => {
    authActionStub.delayMs = 400;
    authActionStub.result = { message: 'Some details are still missing.' };
  },
};

/**
 * None. The banner carries the message alone rather than an empty bullet list —
 * a failure with nothing outstanding is a different failure, and padding it
 * with an empty `<ul>` would read as a rendering bug.
 */
export const BlockersNone: Story = {
  args: { step: 1, completeness: completeness() },
  beforeEach: () => {
    authActionStub.delayMs = 400;
    authActionStub.result = { message: 'That could not be saved.' };
  },
};

/**
 * Submitting. The stub holds for a minute so the disabled control and its
 * "Creating your dealership…" label stay on screen — press Continue.
 *
 * Note that the error a rejected submit produces can land on a field the
 * dealer cannot see: `phone` belongs to step 1. That is why the banner sits
 * above the stepper rather than inside the fieldset.
 */
export const BusinessSubmitting: Story = {
  args: { step: 1 },
  beforeEach: () => {
    authActionStub.delayMs = 60_000;
  },
};

/**
 * Step 3 — a DRAFT dealership exists. The frame's Back/Continue row is gone:
 * from here on the movement is by navigation, and the step brings its own
 * controls, Back included.
 *
 * **Continue does not move while anything is outstanding.** It replaced a
 * "Skip for now" and a Continue that merely counted what was missing — both
 * let a dealer walk to the end of the wizard and only there be told what they
 * had skipped. What counts as outstanding is the server's `completeness`
 * answer, because that is the derivation `POST /v1/dealer/submit` refuses on.
 *
 * The yard photograph sits with the documents because this is the step where a
 * dealer uploads things, but it is required for a different reason: it is the
 * hero of the public portfolio, and a dealership whose storefront would open
 * with an empty frame is not ready to be reviewed.
 */
export const Documents: Story = {
  args: {
    step: 2,
    completeness: completeness({
      business: ['gstin', 'pan'],
      documents: ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF', 'YARD_PHOTO'],
    }),
  },
};

/** The same step once the registrations, the checklist and the photograph are done. */
export const DocumentsComplete: Story = {
  args: {
    step: 2,
    dealer: { gstin: '33AABCS1429B1ZX', pan: 'AABCS1429B' } as DealerProfile,
    completeness: completeness(),
    documents: DOCUMENTS.map((row) => ({
      ...row,
      status: 'VERIFIED' as const,
      fileName: `${row.type.toLowerCase()}.pdf`,
      statusLabel: `${row.type.toLowerCase()}.pdf · verified`,
      action: 'Replace',
    })),
    yardPhoto: {
      mediaId: '00000000-0000-4000-8000-0000000000ff',
      status: 'READY',
      fileName: 'yard-frontage.jpg',
      url: 'https://placehold.co/1200x675/1f2937/e5e7eb.png?text=Yard+frontage',
      uploadedAt: '2026-09-02T09:15:00.000Z',
    },
  },
};

/** A dealership on the session, at whichever point of its life the story needs. */
function dealership(status: 'DRAFT' | 'PENDING_APPROVAL') {
  return {
    id: '00000000-0000-4000-8000-000000000002',
    slug: 'sri-lakshmi-motors',
    brandName: 'Sri Lakshmi Motors',
    status,
    statusLabel: status === 'DRAFT' ? 'Draft' : 'Pending',
    isVerified: false,
    creditBalance: 0,
    creditsHeld: 0,
  } satisfies NonNullable<AuthSession['dealer']>;
}

/**
 * Step 4, before the submit. The dealership is still DRAFT, so the step is a
 * call to action: Back to Documents, or submit for verification.
 *
 * Press Submit to watch the pending state — the stub takes ~1s.
 */
export const Review: Story = {
  args: { step: 3, session: session({}, dealership('DRAFT')), completeness: completeness() },
};

/**
 * Step 4, after. `session.dealer.status` is `PENDING_APPROVAL`, and that single
 * fact replaces the whole form: no submit, no Back.
 *
 * Both absences are deliberate. There is nothing left to submit, and a Back
 * button leading to a form whose answers are already committed would be a lie.
 * The state is read from the session rather than from local state, so a refresh
 * shows this panel rather than the button the dealer already pressed.
 */
export const ReviewSubmitted: Story = {
  args: {
    step: 3,
    session: session({}, dealership('PENDING_APPROVAL')),
    completeness: completeness(),
  },
};

/**
 * A refused submit. Press Submit: the API answers 422 `PROFILE_INCOMPLETE`, and
 * the step lists the same blockers the step-2 banner does — the endpoint
 * decides with the derivation the wizard reads, so the two can only be wrong
 * together.
 */
export const ReviewRefused: Story = {
  args: {
    step: 3,
    session: session({}, dealership('DRAFT')),
    completeness: completeness({
      business: ['pan'],
      documents: ['ADDRESS_PROOF'],
    }),
  },
  beforeEach: () => {
    authActionStub.delayMs = 400;
    authActionStub.result = { message: 'Some details are still missing.' };
  },
};

/**
 * All four at once, which is the only way to see that the stepper fills
 * cumulatively rather than marking a single position — `index <= current`,
 * C015.
 */
export const EveryStep: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      {ONBOARDING_STEPS.map((label, index) => (
        <div key={label}>
          <p style={{ margin: '0 0 10px', fontSize: 12, opacity: 0.55 }}>
            step={index} · {label}
          </p>
          <OnboardingWizard
            step={index as 0 | 1 | 2 | 3}
            session={args.session}
            documents={args.documents}
            dealer={args.dealer}
            completeness={args.completeness}
            yardPhoto={args.yardPhoto}
          />
        </div>
      ))}
    </div>
  ),
};
