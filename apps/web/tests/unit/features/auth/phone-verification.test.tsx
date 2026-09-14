import type { PhoneOtpWidget } from '@dealers-drive/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PhoneVerification } from '@/features/auth/phone-verification';
import { checkPhoneAvailabilityAction, verifyPhoneAction } from '@/features/auth/phone-actions';

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
  checkPhoneAvailabilityAction: vi.fn(),
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
    onRefused: vi.fn(),
    ...overrides,
  };
  render(<PhoneVerification {...props} />);
  return props;
}

/**
 * Send, type, verify.
 *
 * `findAllByLabelText` rather than `getAll`: opening the panel and handing the
 * token over both happen inside a transition, so the assertion has to wait for
 * the render that follows rather than for the click to return.
 */
async function sendAndEnter(user: ReturnType<typeof userEvent.setup>, code: string) {
  await user.click(screen.getByRole('button', { name: 'Send OTP' }));
  await user.type((await screen.findAllByLabelText(/^Digit /))[0]!, code);
  await user.click(screen.getByRole('button', { name: 'Verify & continue' }));
}

beforeEach(() => {
  vi.mocked(verifyPhoneAction).mockReset();
  // Free unless a case says otherwise — step 1 asks this before every send.
  vi.mocked(checkPhoneAvailabilityAction).mockReset().mockResolvedValue({});
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

    // Waited for rather than read on the next tick: the send runs inside a
    // transition, so "no boxes yet" and "no boxes, ever" look the same until
    // it has settled — and only one of them is what this test means.
    await waitFor(() => {
      expect(props.onBeforeSend).toHaveBeenCalled();
    });
    expect(screen.queryAllByLabelText(/^Digit /)).toHaveLength(0);
  });

  it('shows which code the development driver will accept', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Send OTP' }));

    expect(await screen.findByText(/No SMS is sent in this environment/)).toBeInTheDocument();
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
    await waitFor(() => {
      expect(verifyPhoneAction).toHaveBeenCalledWith(
        '9840012345',
        expect.stringMatching(/^dev-otp:919840012345:123456:\d+$/),
      );
    });
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

    expect(await screen.findByText(/That code could not be verified/)).toBeInTheDocument();
    /*
     * `findByText`, not `getByText`. The refusal and the attempts counter are
     * two separate renders — the count is set inside the `startTransition` that
     * wraps the action — so the message can be on screen while the count is
     * still the old one. Asserting it synchronously passes on an idle machine
     * and fails on a loaded CI runner, which is exactly what it did.
     *
     * The test below already knew this ("the count between presses is the
     * synchronisation point, not decoration"); this one was reading the same
     * value the unsafe way.
     */
    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(props.onVerified).not.toHaveBeenCalled();
  });

  it('stops asking after three wrong codes and requires a fresh one', async () => {
    const user = userEvent.setup();
    vi.mocked(verifyPhoneAction).mockResolvedValue({ error: 'Not verified.' });
    renderPanel();

    /*
     * The count between presses is the synchronisation point, not decoration:
     * each verification resolves inside a transition, and pressing again before
     * that render lands would be pressing a disabled button — which passes or
     * fails depending on how loaded the machine is.
     */
    await sendAndEnter(user, '111111');
    expect(await screen.findByText('2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Verify & continue' }));
    expect(await screen.findByText('1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Verify & continue' }));
    expect(await screen.findByText('Ask for a new code to try again.')).toBeInTheDocument();
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

  /**
   * The ordering the whole check rests on: is it a number, is it free, then
   * send. Only the third costs anything, and the second used to be answered by
   * the verification — after the SMS had gone out.
   */
  it('asks whether the number is free before it sends anything', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Send OTP' }));
    await screen.findAllByLabelText(/^Digit /);

    expect(checkPhoneAvailabilityAction).toHaveBeenCalledWith('9840012345');
  });

  it('sends nothing when the number belongs to another dealership', async () => {
    const user = userEvent.setup();
    vi.mocked(checkPhoneAvailabilityAction).mockResolvedValue({
      error: 'That mobile number is already registered to another dealership.',
    });
    const props = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Send OTP' }));

    /*
     * Reported to the step, which owns the input the refusal is about — and
     * **not** also rendered here. Both at once printed the same sentence twice,
     * three lines apart.
     */
    await waitFor(() => {
      expect(props.onRefused).toHaveBeenCalledWith(
        'That mobile number is already registered to another dealership.',
      );
    });
    expect(screen.queryByText(/already registered to another dealership/)).toBeNull();
    // No code panel: nothing was sent, so there is nothing to type.
    expect(screen.queryAllByLabelText(/^Digit /)).toHaveLength(0);
  });

  /** With no field to mark — the sandbox — the panel says it itself. */
  it('shows the refusal itself when nothing else will', async () => {
    const user = userEvent.setup();
    vi.mocked(checkPhoneAvailabilityAction).mockResolvedValue({
      error: 'That mobile number is already registered to another dealership.',
    });
    renderPanel({ onRefused: undefined });

    await user.click(screen.getByRole('button', { name: 'Send OTP' }));

    expect(await screen.findByText(/already registered to another dealership/)).toBeInTheDocument();
  });

  /** The number has not changed since the check that let the first code out. */
  it('does not re-check on a resend', async () => {
    const user = userEvent.setup();
    renderPanel({ initialStage: 'code' });

    await user.click(screen.getByRole('button', { name: 'Resend code' }));

    expect(checkPhoneAvailabilityAction).not.toHaveBeenCalled();
  });

  /** The sandbox's way into the states a real message would otherwise be needed for. */
  it('can be opened directly on the failure state', () => {
    renderPanel({ initialStage: 'failed' });

    expect(screen.getByText('That code did not match')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
