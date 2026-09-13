import type { PhoneOtpWidget } from '@dealers-drive/contracts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { phoneActionStub } from '../../mocks/phone-actions';

import { PhoneVerification } from '@/features/auth/phone-verification';

/**
 * C040b — step 1's mobile check, in its four states (**R39**).
 *
 * DESIGN-SPEC §3.10. The mobile number stopped being something a dealer types
 * and became something they prove: MSG91's OTP widget puts a code on the
 * handset, and the API refuses to build a dealership around a number that was
 * never confirmed.
 *
 * ── What this component decides, and what it does not ───────────────────────
 * Nothing about whether the code was right. The widget runs in the browser and
 * produces a signed token; the token means nothing until the API takes it to
 * MSG91 with a key no browser holds. So `verified` is a **prop** — the
 * session's answer — not something this component remembers, which is why
 * editing the number drops it out of the settled state for free and a reload
 * shows the truth.
 *
 * ── Four things to check by eye ─────────────────────────────────────────────
 *
 *   · **Send OTP.** The panel opens and names the number the code went to.
 *     On the development driver it says which digits will be accepted; no
 *     message is sent and no widget script is loaded.
 *   · **Type into the boxes.** Focus moves forward on a digit and back on
 *     Backspace, and a pasted six-digit code fills all six — which is what a
 *     phone's "copy code" affordance actually produces.
 *   · **Get it wrong.** The panel turns red, keeps the digits so they can be
 *     read back, and counts down the attempts left. Three wrong codes and it
 *     asks for a fresh one rather than spending the server's allowance.
 *   · **Get it right.** The step's forward action becomes *Continue to
 *     business details* — the design puts it in the panel rather than in the
 *     wizard's footer, so there is one state machine rather than two.
 *
 * The Server Action is stubbed (coupling **C-4**): see
 * `src/mocks/phone-actions.ts`.
 */
const FAKE_WIDGET: PhoneOtpWidget = {
  enabled: true,
  driver: 'fake',
  widgetId: null,
  tokenAuth: null,
  devCode: '123456',
  reason: null,
};

/**
 * The wizard's job, done by the story: hold the number and remember which one
 * the session has proved. Without it the settled panel could not be reached by
 * clicking, only by a prop.
 */
function Harness({
  widget = FAKE_WIDGET,
  initialPhone = '9840012345',
  alreadyVerified = false,
  initialStage,
}: {
  widget?: PhoneOtpWidget | null;
  initialPhone?: string;
  alreadyVerified?: boolean;
  initialStage?: 'idle' | 'code' | 'failed';
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [verified, setVerified] = useState<string | null>(alreadyVerified ? initialPhone : null);

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-[14px] p-[20px]">
      <label className="field">
        <span>Phone</span>
        <input
          className="input tnum"
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value);
          }}
        />
      </label>

      <PhoneVerification
        widget={widget}
        phone={phone}
        fullName="R. Manikandan"
        verified={verified !== null && verified === phone.replace(/\D/g, '').slice(-10)}
        onVerified={(proved) => {
          setVerified(proved.replace(/\D/g, '').slice(-10));
        }}
        onContinue={() => undefined}
        onBeforeSend={() => phone.replace(/\D/g, '').length === 10}
        {...(initialStage ? { initialStage } : {})}
      />
    </div>
  );
}

const meta = {
  title: 'Forms/PhoneVerification',
  component: Harness,
  parameters: { layout: 'fullscreen' },
  beforeEach: () => {
    // Free, unless the story about a taken number says otherwise.
    phoneActionStub.availability = {};
    phoneActionStub.result = { verified: true };
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

/** State 1 — the number is typed and nothing has been sent. */
export const SendCode: Story = {
  args: {},
  beforeEach: () => {
    phoneActionStub.result = { verified: true };
    phoneActionStub.availability = {};
    phoneActionStub.calls = [];
  },
};

/**
 * The check that runs **before** a message is sent: the number belongs to
 * another dealership, so nothing is sent at all.
 *
 * This refusal used to arrive with the verification — after the SMS had been
 * paid for and delivered to a handset whose owner had never asked for one.
 * Press **Send OTP** and watch it stop here.
 */
export const NumberAlreadyRegistered: Story = {
  args: {},
  beforeEach: () => {
    phoneActionStub.availability = {
      error: 'That mobile number is already registered to another dealership.',
    };
  },
};

/** State 2 — a code is out. Enter `123456` to settle it. */
export const CodeEntry: Story = {
  args: { initialStage: 'code' },
  beforeEach: () => {
    phoneActionStub.result = { verified: true };
  },
};

/**
 * State 3 — the API refused it. The digits stay so they can be read back
 * against the SMS, and the attempts left are named.
 */
export const Refused: Story = {
  args: { initialStage: 'failed' },
  beforeEach: () => {
    phoneActionStub.result = { error: 'That code could not be verified.' };
  },
};

/** The same panel, with every attempt spent: the only way on is a new code. */
export const AttemptsSpent: Story = {
  args: { initialStage: 'code' },
  beforeEach: () => {
    phoneActionStub.result = { error: 'That code could not be verified.' };
  },
};

/** State 4 — settled, and carrying the step forward. */
export const Verified: Story = {
  args: { alreadyVerified: true },
};

/**
 * A deployment with no MSG91 credentials. The screen says so where the dealer
 * is about to need it, rather than offering a button that fails on click.
 */
export const NotConfigured: Story = {
  args: {
    widget: {
      enabled: false,
      driver: 'msg91',
      widgetId: null,
      tokenAuth: null,
      devCode: null,
      reason: 'Set MSG91_WIDGET_ID and MSG91_WIDGET_TOKEN to verify mobile numbers.',
    },
  },
};

/** The API itself could not be reached — same panel, our own words. */
export const ServiceUnreachable: Story = {
  args: { widget: null },
};
