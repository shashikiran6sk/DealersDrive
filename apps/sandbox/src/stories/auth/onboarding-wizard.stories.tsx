import type {
  AuthSession,
  CitiesResponse,
  DealerDocumentDto,
  DealerProfile,
} from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { authActionStub } from '../../mocks/auth-actions';

import { AuthShell } from '@/components/auth/auth-shell';
import { ONBOARDING_STEPS, OnboardingWizard } from '@/features/auth/onboarding-wizard';

/**
 * DESIGN-SPEC §3.10 — the onboarding wizard (C040).
 *
 * F037 landed the frame — which step is current, how a step is reached and the
 * progress indicator. **F038 lands step 1, F039 step 2 and F041 step 3**;
 * Review arrives with F042, so the last step is still deliberately sparse.
 *
 * `step` is the *server's* answer, not a preference. The page computes a floor
 * from the session — no dealership yet is 0, a DRAFT one is 2, one already
 * submitted is 3 — and clamps `?step=` into it, so the control below stands in
 * for a session state rather than for a click.
 *
 * The wizard calls `useRouter().push` on Back from step 1, which needs the App
 * Router mock — hence `nextjs.appDirectory`. Without it the story throws on
 * that click rather than on render, which is the slower kind of failure to
 * find. It also calls `onboardingAction`, a Server Action, which the sandbox
 * aliases to `src/mocks/auth-actions.ts` (coupling C-4).
 */

/**
 * `GET /v1/cities` as the Business step sees it. The `all` row leads the real
 * response and is a *search filter*, not a place a dealership can be — it is
 * here so the story shows the step dropping it.
 */
const CITIES: CitiesResponse['data'] = [
  { slug: 'all', name: 'All of Tamil Nadu', count: 412 },
  { slug: 'vellore', name: 'Vellore', state: 'Tamil Nadu', count: 88 },
  { slug: 'chennai', name: 'Chennai', state: 'Tamil Nadu', count: 210 },
  { slug: 'coimbatore', name: 'Coimbatore', state: 'Tamil Nadu', count: 134 },
];

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

/** A signed-in Google account with no dealership — the only state step 1 renders in. */
function session(overrides: Partial<AuthSession['user']> = {}, identityName = 'Karthik Raman') {
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
      name: identityName,
      pictureUrl: null,
    },
    dealer: null,
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
    cities: { control: false, description: 'GET /v1/cities. Step 2 is the only reader.' },
    documents: { control: false, description: 'GET /v1/dealer/documents. Step 3 only.' },
    dealer: { control: false, description: 'GET /v1/dealer — GSTIN and PAN. Step 3 only.' },
  },
  args: { step: 0, session: session(), cities: CITIES, documents: DOCUMENTS, dealer: null },
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
 * Two things to look at rather than read. The city list has no "All of Tamil
 * Nadu" in it, though the response does. And State is disabled and unnamed: it
 * follows the city, so the pair cannot disagree.
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
        brandName: 'Enter the name buyers will see.',
        pincode: 'Pincode must be 6 digits.',
        phone: 'Enter a 10-digit Indian mobile number.',
      },
    };
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
 * Step 3 — a DRAFT dealership exists, so the server's floor is 2 and steps 1
 * and 2 are behind you. The frame's Back/Continue row is gone: from here on the
 * movement is by navigation, and the step brings its own controls.
 *
 * Continue names what is still outstanding rather than blocking on it. A dealer
 * may leave with documents missing — the submit on step 4 is what refuses, and
 * it refuses with a list.
 */
export const Documents: Story = { args: { step: 2 } };

/** The same step once the registrations are on file and the checklist is done. */
export const DocumentsComplete: Story = {
  args: {
    step: 2,
    dealer: { gstin: '33AABCS1429B1ZX', pan: 'AABCS1429B' } as DealerProfile,
    documents: DOCUMENTS.map((row) => ({
      ...row,
      status: 'VERIFIED' as const,
      fileName: `${row.type.toLowerCase()}.pdf`,
      statusLabel: `${row.type.toLowerCase()}.pdf · verified`,
      action: 'Replace',
    })),
  },
};

/** Step 4 — submitted, awaiting approval. The floor is 3 and nothing moves. */
export const Review: Story = { args: { step: 3 } };

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
            cities={args.cities}
            documents={args.documents}
            dealer={args.dealer}
          />
        </div>
      ))}
    </div>
  ),
};
