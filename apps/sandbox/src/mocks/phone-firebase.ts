/**
 * Firebase, without Firebase (**R39**).
 *
 * `PhoneVerification` imports `firebase/app` and `firebase/auth` lazily, inside
 * the click handler. `.storybook/main.ts` aliases both to this module so the
 * sandbox never loads the real SDK, never renders a reCAPTCHA it has no domain
 * for, and never sends a message.
 *
 * The point is not to avoid a network call — it is to make the failure states
 * **stageable**. `auth/too-many-requests` and `auth/code-expired` are the two a
 * dealer actually meets, and neither can be produced on demand against a real
 * project; here they are one story parameter.
 */
export interface FirebaseStub {
  /** The code the stub accepts. Anything else is `auth/invalid-verification-code`. */
  code: string;
  /** Thrown by `signInWithPhoneNumber`, so a story can stage a failed send. */
  sendError: string | null;
  /** Thrown by `confirm`, overriding the code check. */
  confirmError: string | null;
  delayMs: number;
}

export const firebaseStub: FirebaseStub = {
  code: '123456',
  sendError: null,
  confirmError: null,
  delayMs: 600,
};

function fail(code: string): Error {
  return Object.assign(new Error(code), { code });
}

async function pause(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, firebaseStub.delayMs));
}

// ── firebase/app ───────────────────────────────────────────────────────────
export function initializeApp(config: unknown): { config: unknown } {
  return { config };
}

export function getApps(): { config: unknown }[] {
  return [];
}

// ── firebase/auth ──────────────────────────────────────────────────────────
export function getAuth(): { useDeviceLanguage: () => void; signOut: () => Promise<void> } {
  return {
    useDeviceLanguage: () => undefined,
    signOut: () => Promise.resolve(),
  };
}

/**
 * A class rather than a factory, because the component calls it with `new` —
 * and an arrow function is not a constructor. It renders nothing: the real
 * widget is invisible anyway, and a story that drew a placeholder for it would
 * be documenting the stub.
 */
export class RecaptchaVerifier {
  clear(): void {
    // Nothing to clear; there is no widget.
  }
}

export async function signInWithPhoneNumber(
  _auth: unknown,
  _phone: string,
  _verifier: unknown,
): Promise<{
  confirm: (code: string) => Promise<{ user: { getIdToken: () => Promise<string> } }>;
}> {
  await pause();
  if (firebaseStub.sendError) throw fail(firebaseStub.sendError);

  return {
    async confirm(code: string) {
      await pause();
      if (firebaseStub.confirmError) throw fail(firebaseStub.confirmError);
      if (code !== firebaseStub.code) throw fail('auth/invalid-verification-code');
      return { user: { getIdToken: () => Promise.resolve('sandbox-id-token') } };
    },
  };
}
