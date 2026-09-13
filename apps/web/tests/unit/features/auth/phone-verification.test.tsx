import type { PhoneOtpWidget } from '@dealers-drive/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PhoneVerification } from '@/features/auth/phone-verification';
import { verifyPhoneAction } from '@/features/auth/phone-actions';

/**
 * R39 — the four states of step 1's mobile check.
 *
 * The claims worth pinning are all about **what this component refuses to
 * decide**. It does not judge a code; it hands a token to the server and
 * renders the answer. It does not remember a success across a reload; the
 * session does, and `verified` is a prop. And it will not send a message for a
 * number the step has not validated, because an SMS costs money and one sent to
 * a mistyped number is money spent reaching a stranger.
 *
 * The `fake` driver is used throughout, which loads no widget script and
 * therefore reaches no network — but every other line of the flow, including
 * the server action and the refusals, is the production path.
 */
vi.mock('@/features/auth/phone-actions', () => ({
  verifyPhoneAction: vi.fn(),
}));

const FAKE: PhoneOtpWidget = {
  enabled: true,
  driver: 'fake',
  widgetId: null,
  tokenAuth: null,
  devCode: '123456',
  reason: null,
};

function renderPanel(overrides: Partial<Parameters<typeof PhoneVerification>[0]> = {}) {
  const props = {
    widget: FAKE,
    phone: '9840012345',
    fullName: 'R. Manikandan',
    verified: false,
    onVerified: vi.fn(),
    onContinue: vi.fn(),
    onBeforeSend: vi.fn(() => true),
    ...overrides,
  };
  render(<PhoneVerification {...props} />);
  return props;
}

async function sendAndEnter(user: ReturnType<typeof userEvent.setup>, code: string) {
  await user.click(screen.getByRole('button', { name: 'Send OTP' }));
  await user.type(screen.getAllByLabelText(/^Digit /)[0]!, code);
  await user.click(screen.getByRole('button', { name: 'Verify & continue' }));
}

beforeEach(() => {
  vi.mocked(verifyPhoneAction).mockReset();
});

describe('PhoneVerification', () => {
  it('opens on the step’s forward action, not on a code box', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: 'Send OTP' })).toBeInTheDocument();
    expect(screen.queryAllByLabelText(/^Digit /)).toHaveLength(0);
  });

  /**
   * The step's own validation runs *before* anything is sent. A number the
   * dealer has not finished typing must not cost a message, and the message it
   * would cost would go to somebody else.
   */
  it('sends nothing when the step refuses the fields above it', async () => {
    const user = userEvent.setup();
    const props = renderPanel({ onBeforeSend: vi.fn(() => false) });

    await user.click(screen.getByRole('button', { name: 'Send OTP' }));

    expect(props.onBeforeSend).toHaveBeenCalled();
    expect(screen.queryAllByLabelText(/^Digit /)).toHaveLength(0);
  });

  it('shows which code the development driver will accept', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Send OTP' }));

    expect(screen.getByText(/No SMS is sent in this environment/)).toBeInTheDocument();
    expect(screen.getByText('123456')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Digit /)).toHaveLength(6);
  });

  /** The server is the only party that can judge the token; this is the handoff. */
  it('hands the token to the server and reports what it answered', async () => {
    const user = userEvent.setup();
    vi.mocked(verifyPhoneAction).mockResolvedValue({ verified: true, phone: '+919840012345' });
    const props = renderPanel();

    await sendAndEnter(user, '123456');

    /*
     * The token names the number it claims, because on this driver there is no
     * provider to name it — and the trailing nonce is what keeps the server's
     * replay guard from refusing a second attempt in one sitting.
     */
    expect(verifyPhoneAction).toHaveBeenCalledWith(
      '9840012345',
      expect.stringMatching(/^dev-otp:919840012345:123456:\d+$/),
    );
    expect(props.onVerified).toHaveBeenCalledWith('+919840012345');
  });

  /**
   * A refusal comes back as the API's sentence, and the panel turns red rather
   * than advancing. The component has no opinion of its own about the code.
   */
  it('renders the server’s refusal, and counts the attempt', async () => {
    const user = userEvent.setup();
    vi.mocked(verifyPhoneAction).mockResolvedValue({ error: 'That code could not be verified.' });
    const props = renderPanel();

    await sendAndEnter(user, '111111');

    expect(screen.getByText(/That code could not be verified/)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(props.onVerified).not.toHaveBeenCalled();
  });

  it('stops asking after three wrong codes and requires a fresh one', async () => {
    const user = userEvent.setup();
    vi.mocked(verifyPhoneAction).mockResolvedValue({ error: 'Not verified.' });
    renderPanel();

    await sendAndEnter(user, '111111');
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await user.clear(screen.getAllByLabelText(/^Digit /)[0]!);
      await user.type(screen.getAllByLabelText(/^Digit /)[0]!, '111111');
      await user.click(screen.getByRole('button', { name: 'Verify & continue' }));
    }

    expect(screen.getByText('Ask for a new code to try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify & continue' })).toBeDisabled();
  });

  /**
   * `verified` is the session's answer, not this component's memory — which is
   * what makes a reload show the truth rather than whatever the page last
   * believed.
   */
  it('renders the settled state from the prop alone', () => {
    renderPanel({ verified: true });

    expect(screen.getByText('Mobile number verified')).toBeInTheDocument();
    expect(screen.getByText('+91 98400 12345')).toBeInTheDocument();
    expect(screen.getByText('R. Manikandan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to business details' })).toBeEnabled();
  });

  it('carries the step forward from the settled panel', async () => {
    const user = userEvent.setup();
    const props = renderPanel({ verified: true });

    await user.click(screen.getByRole('button', { name: 'Continue to business details' }));

    expect(props.onContinue).toHaveBeenCalled();
  });

  /**
   * A deployment that cannot verify says so, and says so where the dealer is
   * about to need it — rather than offering a button that fails on click.
   */
  it('explains itself when verification is not configured', () => {
    renderPanel({
      widget: {
        enabled: false,
        driver: 'msg91',
        widgetId: null,
        tokenAuth: null,
        devCode: null,
        reason: 'Set MSG91_WIDGET_ID and MSG91_WIDGET_TOKEN to verify mobile numbers.',
      },
    });

    expect(screen.getByText('Mobile verification is unavailable')).toBeInTheDocument();
    expect(screen.getByText(/MSG91_WIDGET_ID/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send OTP' })).toBeNull();
  });

  it('says the same when the API could not be reached at all', () => {
    renderPanel({ widget: null });

    expect(screen.getByText('Mobile verification is unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send OTP' })).toBeNull();
  });

  /** The sandbox's way into the states a real message would otherwise be needed for. */
  it('can be opened directly on the failure state', () => {
    renderPanel({ initialStage: 'failed' });

    expect(screen.getByText('That code did not match')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
