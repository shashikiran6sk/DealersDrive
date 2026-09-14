import type {
  AuthSession,
  CompletenessResponse,
  DealerDocumentDto,
  DealerProfile,
  PhoneOtpWidget,
  YardPhotoDto,
} from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { authActionStub } from '../../mocks/auth-actions';
import { phoneActionStub } from '../../mocks/phone-actions';

import { AuthShell } from '@/components/auth/auth-shell';
import { ONBOARDING_STEPS, OnboardingWizard } from '@/features/auth/onboarding-wizard';

const NO_YARD_PHOTO: YardPhotoDto = {
  mediaId: null,
  status: null,
  fileName: null,
  url: null,
  uploadedAt: null,
};

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

const FAKE_PHONE_WIDGET: PhoneOtpWidget = {
  enabled: true,
  driver: 'fake',
  widgetId: null,
  tokenAuth: null,
  devCode: '123456',
  reason: null,
};

function session(
  overrides: Partial<AuthSession['user']> = {},
  dealer: AuthSession['dealer'] = null,
) {
  return {
    next: 'ONBOARDING',
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      fullName: null,
      phone: '',
      phoneDisplay: '',
      phoneVerified: false,
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
    phoneWidget: {
      control: false,
      description:
        'GET /v1/auth/phone/widget (**R39**). The MSG91 credentials, read on the server so a ' +
        'rotation is a restart rather than a rebuild. `fake` here: no script, no SMS.',
    },
  },
  args: {
    step: 0,
    session: session(),
    documents: DOCUMENTS,
    dealer: null,
    completeness: null,
    yardPhoto: NO_YARD_PHOTO,
    phoneWidget: FAKE_PHONE_WIDGET,
  },
  beforeEach: () => {
    phoneActionStub.result = { verified: true };
    phoneActionStub.calls.length = 0;
    authActionStub.result = {};
    authActionStub.delayMs = 900;
    authActionStub.calls.length = 0;
  },
} satisfies Meta<typeof OnboardingWizard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Account: Story = { args: { step: 0 } };

export const AccountPrefilled: Story = {
  args: {
    step: 0,
    session: session({ fullName: 'K. Raman', phone: '9840012345' }),
  },
};

export const AccountVerified: Story = {
  args: {
    step: 0,
    session: session({
      fullName: 'K. Raman',
      phone: '9840012345',
      phoneDisplay: '+91 98400 12345',
      phoneVerified: true,
    }),
  },
};

export const Business: Story = { args: { step: 1 } };

export const BusinessWithTaglineAndServices: Story = {
  args: {
    step: 1,
    dealer: {
      legalName: 'Sri Balaji Motors',
      tagline:
        'Family-run since 1998 \u2014 hatchbacks under \u20b96 lakh, every one inspected in-house.',
      specialities: ['In-house workshop', 'RC transfer assistance', 'Bank loan tie-ups'],
      address: {
        line: '18, Gandhi Road',
        city: 'Katpadi',
        district: 'Vellore',
        state: 'Tamil Nadu',
        pincode: '632007',
        mapsUrl: 'https://maps.app.goo.gl/8QwYh2v1kFqL3mNz9',
      },
      contact: { landline: '0416 224 8890' },
    } as DealerProfile,
  },
};

export const ChangesRequested: Story = {
  args: {
    step: 0,
    dealer: {
      status: 'DRAFT',
      statusReason:
        'The address on your GST certificate is in Gudiyatham, but the yard address you entered is in Katpadi. Please correct whichever one is wrong.',
    } as DealerProfile,
  },
};

export const ChangesRequestedMultiline: Story = {
  args: {
    step: 0,
    dealer: {
      status: 'DRAFT',
      statusReason:
        '1. The GST certificate is a photograph of a screen and the number is not legible.\n2. Your Maps pin is on the main road rather than on the yard itself.',
    } as DealerProfile,
  },
};

export const BusinessFieldErrors: Story = {
  args: { step: 1 },
  beforeEach: () => {
    authActionStub.delayMs = 400;
    authActionStub.result = {
      message: 'That could not be saved.',
      errors: {
        legalName: 'Enter your dealership’s registered name.',
        pincode: 'Pincode must be 6 digits.',
        mapsUrl: 'That is not a Google Maps link.',
      },
    };
  },
};

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

export const BlockersOne: Story = {
  args: { step: 1, completeness: completeness({ documents: ['ADDRESS_PROOF'] }) },
  beforeEach: () => {
    authActionStub.delayMs = 400;
    authActionStub.result = { message: 'Some details are still missing.' };
  },
};

export const BlockersNone: Story = {
  args: { step: 1, completeness: completeness() },
  beforeEach: () => {
    authActionStub.delayMs = 400;
    authActionStub.result = { message: 'That could not be saved.' };
  },
};

export const BusinessSubmitting: Story = {
  args: { step: 1 },
  beforeEach: () => {
    authActionStub.delayMs = 60_000;
  },
};

export const PhoneNotVerified: Story = {
  args: { step: 1 },
  beforeEach: () => {
    authActionStub.delayMs = 400;
    authActionStub.result = {
      message: 'Verify this mobile number before continuing — we send a one-time code to it.',
      errors: { phone: 'Verify this number first.' },
    };
  },
};

export const Documents: Story = {
  args: {
    step: 2,
    completeness: completeness({
      business: ['tagline', 'specialities', 'gstin', 'pan'],
      documents: ['GST_CERTIFICATE', 'PAN_CARD', 'ADDRESS_PROOF', 'YARD_PHOTO'],
    }),
  },
};

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

export const Review: Story = {
  args: { step: 3, session: session({}, dealership('DRAFT')), completeness: completeness() },
};

export const ReviewSubmitted: Story = {
  args: {
    step: 3,
    session: session({}, dealership('PENDING_APPROVAL')),
    completeness: completeness(),
  },
};

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
            phoneWidget={args.phoneWidget}
          />
        </div>
      ))}
    </div>
  ),
};
