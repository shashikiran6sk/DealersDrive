import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PhoneVerification } from '@/features/auth/phone-verification';

import { firebaseStub } from '../../mocks/phone-firebase';
import { phoneActionStub } from '../../mocks/phone-actions';

/**
 * C073 — the mobile number, proved (**R39**). DESIGN-SPEC §3.10, step 1.
 *
 * ── What this is, and what it is not ────────────────────────────────────────
 * It is **not a sign-in**. Google is the dealer's door and always will be; a
 * dealer who signs in tomorrow is not asked for a code, because
 * `phoneVerifiedAt` is a column on their user record rather than anything the
 * session carries. What happens here is a claim about a *handset*, by somebody
 * the platform has already authenticated.
 *
 * ── The exchange, in three states ───────────────────────────────────────────
 * `number` → `code` → `verified`, and the way back from `verified` is a
 * **Change** button rather than an editable box. That is the whole argument
 * R7 and R27 were having, settled: the number is changeable, and changing it is
 * not an *edit* — it is a new claim about a different handset, and it goes
 * through a code like the first one did.
 *
 * ── What is stubbed, and why it is two stubs ────────────────────────────────
 * `phone-actions.ts` stands in for the API and `phone-firebase.ts` for Google.
 * Keeping them separate is what makes the failures stageable: *already
 * registered* is the API refusing before an SMS is sent and must never reach
 * Firebase, while *wrong code* is Firebase refusing and never reaches the API.
 * Neither can be produced on demand against a real project.
 *
 * ── Four things to check by eye ─────────────────────────────────────────────
 *
 *   · **Send code** with `9840012345`. The button shows its loading state while
 *     the server normalises the number — that round trip is not decoration, it
 *     is what makes the browser hand Firebase exactly what our records hold.
 *   · **Type `123456`.** Verify is dead below six digits, and the box drops
 *     anything that is not one.
 *   · **Try `000000`.** The refusal is Firebase's, said in the product's voice.
 *   · **The verified row.** Disabled control, `Verified` tag, `Change` button —
 *     and a hidden `phoneVerified` the wizard's step-1 gate actually reads.
 */
const meta = {
  title: 'Auth/PhoneVerification',
  component: PhoneVerification,
  parameters: { layout: 'padded' },
  args: {
    firebase: {
      apiKey: 'AIzaSySandboxKeyNotARealOne',
      authDomain: 'dealers-drive-sandbox.firebaseapp.com',
      projectId: 'dealers-drive-sandbox',
    },
    verified: false,
    initialPhone: '',
    initialPhoneDisplay: '',
  },
  decorators: [
    (Story) => (
      // A real `<form>`: the component's hidden `phoneVerified` field only
      // means anything inside one, and that field is what the wizard reads.
      <form
        style={{ maxWidth: 420 }}
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <Story />
      </form>
    ),
  ],
} satisfies Meta<typeof PhoneVerification>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Reset both stubs, so a story never inherits the one before it. */
function reset(
  overrides: {
    start?: typeof phoneActionStub.start;
    verify?: typeof phoneActionStub.verify;
    firebase?: Partial<typeof firebaseStub>;
  } = {},
): void {
  phoneActionStub.calls = [];
  phoneActionStub.start = overrides.start ?? {
    phone: '+919840012345',
    phoneDisplay: '+91 98400 12345',
  };
  phoneActionStub.verify = overrides.verify ?? {
    verified: true,
    phone: '+919840012345',
    phoneDisplay: '+91 98400 12345',
  };
  firebaseStub.code = overrides.firebase?.code ?? '123456';
  firebaseStub.sendError = overrides.firebase?.sendError ?? null;
  firebaseStub.confirmError = overrides.firebase?.confirmError ?? null;
}

/** The opening state: a new dealership, nothing proved yet. */
export const Empty: Story = {
  decorators: [
    (Story) => {
      reset();
      return <Story />;
    },
  ],
};

/** A dealer coming back to step 1 with a number already on their record. */
export const Prefilled: Story = {
  args: { initialPhone: '+919840012345', initialPhoneDisplay: '+91 98400 12345' },
  decorators: [
    (Story) => {
      reset();
      return <Story />;
    },
  ],
};

/**
 * The end state. Disabled control, the tag, and the way back — plus the hidden
 * `phoneVerified` that lets the wizard's Continue button work at all.
 */
export const Verified: Story = {
  args: {
    verified: true,
    initialPhone: '+919840012345',
    initialPhoneDisplay: '+91 98400 12345',
  },
  decorators: [
    (Story) => {
      reset();
      return <Story />;
    },
  ],
};

/**
 * The API refuses before an SMS is sent. Press **Send code** — Firebase is
 * never reached, which is the point: a number another dealership holds cannot
 * become this one's however many codes are sent to it, and Firebase's free tier
 * is a per-project daily message count everybody shares.
 */
export const AlreadyRegistered: Story = {
  decorators: [
    (Story) => {
      reset({
        start: {
          fieldError: 'Already registered.',
          error: 'That mobile number is already registered to another dealership.',
        },
      });
      return <Story />;
    },
  ],
};

/**
 * Send a code, then enter anything other than `123456`. The refusal is
 * Firebase's `auth/invalid-verification-code`, translated once, here.
 */
export const WrongCode: Story = {
  decorators: [
    (Story) => {
      reset({ firebase: { code: '999999' } });
      return <Story />;
    },
  ],
};

/** Send a code, then enter any six digits: Firebase says the code has expired. */
export const ExpiredCode: Story = {
  decorators: [
    (Story) => {
      reset({ firebase: { confirmError: 'auth/code-expired' } });
      return <Story />;
    },
  ],
};

/**
 * The one a dealer actually meets. The per-number and per-project quotas are
 * real and are hit by testing, and "try again later" without saying *why* is
 * the message that generates a support ticket.
 */
export const TooManyRequests: Story = {
  decorators: [
    (Story) => {
      reset({ firebase: { sendError: 'auth/too-many-requests' } });
      return <Story />;
    },
  ],
};

/**
 * The dealer's connection dropped mid-send. Distinct from a quota, because the
 * advice is different: check the connection rather than wait.
 */
export const NetworkFailed: Story = {
  decorators: [
    (Story) => {
      reset({ firebase: { sendError: 'auth/network-request-failed' } });
      return <Story />;
    },
  ],
};

/**
 * **`PHONE_VERIFICATION_DRIVER=fake`** — a local deployment with no Firebase
 * project. `null` is a first-class state rather than a misconfiguration, and
 * the panel says which four variables would change it.
 */
export const NoFirebaseConfigured: Story = {
  args: { firebase: null },
  decorators: [
    (Story) => {
      reset();
      return <Story />;
    },
  ],
};

/** The wizard's own refusal, when Continue is pressed on an unverified number. */
export const StepRefusedToContinue: Story = {
  args: { error: 'Verify your mobile number to continue.' },
  decorators: [
    (Story) => {
      reset();
      return <Story />;
    },
  ],
};
