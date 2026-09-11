import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as PhoneActions from '@/features/auth/phone-actions';
import { PhoneVerification } from '@/features/auth/phone-verification';

/**
 * The OTP step (**R39**), without an SMS and without Firebase.
 *
 * Two seams are mocked and no more. The **server actions** stand in for the
 * API, and `firebase/auth` stands in for Google — everything between them is
 * the real component. That is what lets these cases assert on the things that
 * actually go wrong in this flow: a number another dealership holds, a wrong
 * code, an expired one, a project that is not configured at all.
 *
 * What is deliberately *not* asserted is reCAPTCHA. It cannot render in jsdom
 * and pinning it would be pinning the mock; the sandbox story is where the
 * widget is looked at by eye.
 */
const start = vi.fn<typeof PhoneActions.startPhoneVerificationAction>();
const verify = vi.fn<typeof PhoneActions.verifyPhoneAction>();

vi.mock('@/features/auth/phone-actions', () => ({
  startPhoneVerificationAction: (phone: string) => start(phone),
  verifyPhoneAction: (idToken: string) => verify(idToken),
}));

const confirm = vi.fn();
const signInWithPhoneNumber = vi.fn();
const signOut = vi.fn(() => Promise.resolve());

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'test' })),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ useDeviceLanguage: vi.fn(), signOut })),
  // A `class`, not an arrow: the component calls it with `new`, and a `vi.fn()`
  // whose implementation is an arrow function is not a constructor.
  RecaptchaVerifier: class {
    clear = vi.fn();
  },
  signInWithPhoneNumber: (...args: unknown[]): unknown => signInWithPhoneNumber(...args),
}));

const FIREBASE = {
  apiKey: 'AIzaSyTest',
  authDomain: 'dd-test.firebaseapp.com',
  projectId: 'dd-test',
};

beforeEach(() => {
  vi.clearAllMocks();
  start.mockResolvedValue({ phone: '+919840012345', phoneDisplay: '+91 98400 12345' });
  verify.mockResolvedValue({
    verified: true,
    phone: '+919840012345',
    phoneDisplay: '+91 98400 12345',
  });
  confirm.mockResolvedValue({ user: { getIdToken: () => Promise.resolve('firebase-id-token') } });
  signInWithPhoneNumber.mockResolvedValue({ confirm });
});

function view(props: Partial<React.ComponentProps<typeof PhoneVerification>> = {}) {
  return render(
    <form>
      <PhoneVerification firebase={FIREBASE} verified={false} {...props} />
    </form>,
  );
}

describe('an already-verified number', () => {
  it('is shown rather than asked for again', () => {
    view({ verified: true, initialPhone: '+919840012345', initialPhoneDisplay: '+91 98400 12345' });

    expect(screen.getByLabelText(/^Mobile/)).toBeDisabled();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send code/i })).toBeNull();
  });

  /** The hidden flag is what the wizard's step-1 gate actually reads. */
  it('carries the flag the step gate reads', () => {
    const { container } = view({ verified: true, initialPhone: '+919840012345' });

    expect(container.querySelector('input[name="phoneVerified"]')).toHaveValue('true');
  });

  it('carries no flag when nothing has been verified', () => {
    const { container } = view();

    expect(container.querySelector('input[name="phoneVerified"]')).toHaveValue('');
  });

  /**
   * Changing the number is not an edit. It is a new claim about a different
   * handset, so it goes back to the start of the exchange rather than
   * unlocking a box.
   */
  it('offers a way back to the beginning', async () => {
    const user = userEvent.setup();
    const { container } = view({ verified: true, initialPhone: '+919840012345' });

    await user.click(screen.getByRole('button', { name: 'Change' }));

    expect(screen.getByLabelText(/^Mobile/)).toBeEnabled();
    expect(container.querySelector('input[name="phoneVerified"]')).toHaveValue('');
  });
});

describe('sending a code', () => {
  /**
   * **The number goes to our server first**, and what comes back is what
   * Firebase is handed. Two implementations of that conversion is a bug nobody
   * can see: the code arrives, the dealer enters it, and the number stored is
   * not the number that was texted.
   */
  it('normalises through the API before asking Firebase for anything', async () => {
    const user = userEvent.setup();
    view();

    await user.type(screen.getByLabelText(/^Mobile/), '98400 12345');
    await user.click(screen.getByRole('button', { name: /send code/i }));

    await waitFor(() => {
      expect(start).toHaveBeenCalledWith('98400 12345');
    });
    expect(signInWithPhoneNumber).toHaveBeenCalledWith(
      expect.anything(),
      '+919840012345',
      expect.anything(),
    );
  });

  it('moves to the code box and says where the code went', async () => {
    const user = userEvent.setup();
    view();

    await user.type(screen.getByLabelText(/^Mobile/), '9840012345');
    await user.click(screen.getByRole('button', { name: /send code/i }));

    expect(await screen.findByPlaceholderText(/6-digit code/i)).toBeInTheDocument();
    expect(screen.getByText(/code sent to \+91 98400 12345/i)).toBeInTheDocument();
  });

  /**
   * A number another dealership holds is refused **before** the SMS. That is
   * kinder to the dealer and cheaper for everybody — Firebase's free tier is a
   * per-project daily message count.
   */
  it('never reaches Firebase when the number is already registered', async () => {
    const user = userEvent.setup();
    start.mockResolvedValue({
      fieldError: 'Already registered.',
      error: 'That mobile number is already registered to another dealership.',
    });
    view();

    await user.type(screen.getByLabelText(/^Mobile/), '9840012345');
    await user.click(screen.getByRole('button', { name: /send code/i }));

    expect(await screen.findByText('Already registered.')).toBeInTheDocument();
    expect(signInWithPhoneNumber).not.toHaveBeenCalled();
  });

  it('says so when this deployment has no Firebase project', async () => {
    const user = userEvent.setup();
    view({ firebase: null });

    expect(screen.getByText(/no Firebase project configured/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Mobile/), '9840012345');
    await user.click(screen.getByRole('button', { name: /send code/i }));

    expect(await screen.findByText(/not configured for this environment/i)).toBeInTheDocument();
    expect(signInWithPhoneNumber).not.toHaveBeenCalled();
  });

  /**
   * Firebase's own codes, said once in the product's voice.
   * `auth/too-many-requests` is the one a dealer actually meets — the quotas
   * are real and are hit by testing — and "try again later" without saying why
   * is the message that generates a support ticket.
   */
  it.each([
    ['auth/too-many-requests', /too many attempts/i],
    ['auth/quota-exceeded', /cannot send a code right now/i],
    ['auth/captcha-check-failed', /security check did not pass/i],
    ['auth/network-request-failed', /network dropped/i],
    ['auth/something-nobody-has-seen', /that did not work/i],
  ])('translates %s', async (code, expected) => {
    const user = userEvent.setup();
    signInWithPhoneNumber.mockRejectedValue(Object.assign(new Error('firebase'), { code }));
    view();

    await user.type(screen.getByLabelText(/^Mobile/), '9840012345');
    await user.click(screen.getByRole('button', { name: /send code/i }));

    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  /**
   * **Deployment faults, not dealer faults.**
   *
   * `auth/billing-not-enabled` is the one that prompted this: Firebase Phone
   * Authentication requires the Blaze plan, the SDK has no mapping for the
   * server's `BILLING_NOT_ENABLED` so it arrives kebab-cased, and it used to
   * fall through to "try again" — an instruction to fail repeatedly against a
   * project that cannot send anything.
   *
   * None of these is something a dealer can act on, so all six say so.
   */
  it.each([
    ['auth/billing-not-enabled'],
    ['auth/operation-not-allowed'],
    ['auth/unauthorized-domain'],
    ['auth/invalid-app-credential'],
    ['auth/api-key-not-valid'],
    ['auth/internal-error'],
  ])('does not blame the dealer for %s', async (code) => {
    const user = userEvent.setup();
    signInWithPhoneNumber.mockRejectedValue(Object.assign(new Error('firebase'), { code }));
    view();

    await user.type(screen.getByLabelText(/^Mobile/), '9840012345');
    await user.click(screen.getByRole('button', { name: /send code/i }));

    expect(await screen.findByText(/unavailable right now\. This is on us/i)).toBeInTheDocument();
    // And never the sentence that invites them to keep trying.
    expect(screen.queryByText(/try again, or contact support/i)).toBeNull();
  });

  /**
   * **The defect this whole block exists because of.**
   *
   * A dealer never opens a console; the person they contact always does. When
   * the provider's own explanation is caught, mapped to a sentence that
   * disclaims knowledge of the cause, and dropped, the failure is undiagnosable
   * from the screen — which is exactly what happened the first time a real
   * project was wired up.
   */
  it('logs the provider’s own code and message, whatever the code', async () => {
    const user = userEvent.setup();
    const logged = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    signInWithPhoneNumber.mockRejectedValue(
      Object.assign(new Error('Firebase: Error (auth/billing-not-enabled).'), {
        code: 'auth/billing-not-enabled',
      }),
    );
    view();

    await user.type(screen.getByLabelText(/^Mobile/), '9840012345');
    await user.click(screen.getByRole('button', { name: /send code/i }));
    await screen.findByText(/unavailable right now/i);

    const printed = logged.mock.calls.flat().map(String).join(' ');
    expect(printed).toContain('auth/billing-not-enabled');
    // And the fix, not just the symptom.
    expect(printed).toMatch(/Blaze/);
    logged.mockRestore();
  });

  /**
   * **`console.warn`, never `console.error`** — pinned, because the difference
   * is invisible until it is a full-screen overlay.
   *
   * Next's dev overlay patches `console.error` only, and when the first
   * argument is not an `Error` it takes `args[1]` as one — which is exactly the
   * raw error attached here. Using `error` therefore interrupted development
   * with an overlay every time a dealer mistyped a code, for a failure the
   * screen already reports properly.
   */
  it('does not raise a Next dev overlay for a handled failure', async () => {
    const user = userEvent.setup();
    const asError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const asWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    signInWithPhoneNumber.mockRejectedValue(
      Object.assign(new Error('firebase'), { code: 'auth/invalid-phone-number' }),
    );
    view();

    await user.type(screen.getByLabelText(/^Mobile/), '9840012345');
    await user.click(screen.getByRole('button', { name: /send code/i }));
    await screen.findByText(/does not look like a mobile number/i);

    expect(asWarn).toHaveBeenCalled();
    expect(asError).not.toHaveBeenCalled();
    asError.mockRestore();
    asWarn.mockRestore();
  });

  /** An error with no `code` at all still reaches the console. */
  it('logs a failure that carries no code', async () => {
    const user = userEvent.setup();
    const logged = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    signInWithPhoneNumber.mockRejectedValue(new Error('something else entirely'));
    view();

    await user.type(screen.getByLabelText(/^Mobile/), '9840012345');
    await user.click(screen.getByRole('button', { name: /send code/i }));
    await screen.findByText(/that did not work/i);

    expect(logged.mock.calls.flat().map(String).join(' ')).toContain('something else entirely');
    logged.mockRestore();
  });
});

describe('entering the code', () => {
  async function toCodeStage() {
    const user = userEvent.setup();
    view();
    await user.type(screen.getByLabelText(/^Mobile/), '9840012345');
    await user.click(screen.getByRole('button', { name: /send code/i }));
    await screen.findByPlaceholderText(/6-digit code/i);
    return user;
  }

  it('hands the ID token to the server and shows the badge', async () => {
    const user = await toCodeStage();

    await user.type(screen.getByPlaceholderText(/6-digit code/i), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(verify).toHaveBeenCalledWith('firebase-id-token');
    });
    expect(await screen.findByText('Verified')).toBeInTheDocument();
  });

  /**
   * The Firebase sign-in is a means, not an end. Ours is the session that
   * matters, so the browser's Firebase session is discarded the moment the
   * token has been handed over — a second identity in the tab serves nobody.
   */
  it('signs out of Firebase once the token has been handed over', async () => {
    const user = await toCodeStage();

    await user.type(screen.getByPlaceholderText(/6-digit code/i), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
    });
  });

  it('will not submit a code that is too short', async () => {
    const user = await toCodeStage();

    await user.type(screen.getByPlaceholderText(/6-digit code/i), '123');

    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
  });

  it('drops anything that is not a digit', async () => {
    const user = await toCodeStage();

    await user.type(screen.getByPlaceholderText(/6-digit code/i), '12a3b4');

    expect(screen.getByPlaceholderText(/6-digit code/i)).toHaveValue('1234');
  });

  it.each([
    ['auth/invalid-verification-code', /that code is not right/i],
    ['auth/code-expired', /that code has expired/i],
  ])('translates %s', async (code, expected) => {
    const user = await toCodeStage();
    confirm.mockRejectedValue(Object.assign(new Error('firebase'), { code }));

    await user.type(screen.getByPlaceholderText(/6-digit code/i), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.queryByText('Verified')).toBeNull();
  });

  /** The API's own refusal, when the token was fine and the record was not. */
  it('shows what the server said when it refuses the token', async () => {
    const user = await toCodeStage();
    verify.mockResolvedValue({ error: 'That code has expired. Send a new one and try again.' });

    await user.type(screen.getByPlaceholderText(/6-digit code/i), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText(/that code has expired/i)).toBeInTheDocument();
    expect(screen.queryByText('Verified')).toBeNull();
  });

  it('offers a way back to the number and a way to resend', async () => {
    const user = await toCodeStage();

    expect(screen.getByRole('button', { name: /change number/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /send it again/i }));

    await waitFor(() => {
      expect(start).toHaveBeenCalledTimes(2);
    });
  });
});
