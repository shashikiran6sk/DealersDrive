'use client';

import type { PublicConfig } from '@dealers-drive/contracts';
import { useEffect, useRef, useState, useTransition } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusTag } from '@/components/ui/primitives';
import {
  startPhoneVerificationAction,
  verifyPhoneAction,
  type PhoneState,
} from '@/features/auth/phone-actions';

/**
 * DESIGN-SPEC §3.10, step 1 — the mobile number, proved (**R39**).
 *
 * ── What this is, and what it is not ────────────────────────────────────────
 * It is **not a sign-in**. Google is the dealer's door and always will be; a
 * dealer who signs in tomorrow is not asked for a code, because
 * `phoneVerifiedAt` is a column on their user record rather than anything the
 * session carries. What happens here is a claim about a *handset* by somebody
 * the platform has already authenticated.
 *
 * ── Why the Firebase SDK is loaded lazily ───────────────────────────────────
 * It is ~200 KB and reCAPTCHA pulls more. Nobody past step 1 ever needs it, and
 * a dealer who has already verified never needs it at all — so the import is
 * inside the click handler rather than at the top of the file, and the bundle
 * for every other screen is unchanged.
 *
 * ── Why the number goes to our server first ─────────────────────────────────
 * `POST /v1/auth/phone/start` normalises it to E.164 and says whether it is
 * free. Doing the conversion here would put two implementations of one rule in
 * the product, and the failure when they disagree is invisible: the code
 * arrives, the dealer enters it, the verification succeeds, and the number
 * stored is not the number that was texted. Checking availability before the
 * SMS is the other half — a number another dealership holds cannot become this
 * one's however many codes are sent to it, and Firebase's free tier is a daily
 * message count everybody shares.
 */
type Stage = 'number' | 'code' | 'verified';

export interface PhoneVerificationProps {
  /** From `GET /v1/config/public`. `null` when this deployment has no Firebase. */
  firebase: PublicConfig['firebase'];
  /** What the session already holds, so a returning dealer is not asked again. */
  initialPhone?: string;
  initialPhoneDisplay?: string;
  verified: boolean;
  /**
   * The wizard's own refusal, when Continue is pressed on an unverified number.
   *
   * It arrives as a prop rather than being raised here because the *step*
   * decides when to complain, not the field: the dealer has not done anything
   * wrong until they try to leave. The component's own `fieldError` — a number
   * another dealership holds, say — takes precedence, because it is the more
   * specific of the two and is about the value in front of them.
   */
  error?: string;
}

export function PhoneVerification({
  firebase,
  initialPhone = '',
  initialPhoneDisplay = '',
  verified,
  error,
}: PhoneVerificationProps) {
  const [stage, setStage] = useState<Stage>(verified ? 'verified' : 'number');
  // `+91` off, because the box asks for the ten digits the label's hint shows.
  const [typed, setTyped] = useState(initialPhone.replace(/^\+91/, ''));
  const [display, setDisplay] = useState(initialPhoneDisplay);
  const [e164, setE164] = useState(initialPhone);
  const [code, setCode] = useState('');
  const [state, setState] = useState<PhoneState>({});
  const [pending, startTransition] = useTransition();

  /**
   * The reCAPTCHA widget and the pending confirmation, held outside React.
   *
   * Both are Firebase objects with their own lifecycle: the verifier owns a DOM
   * node it renders into, and the confirmation is a one-shot handle that must
   * be the *same* object the code is confirmed against. Putting either in state
   * would re-render them into existence twice and produce the failure Firebase
   * reports as `auth/internal-error`, which says nothing about the cause.
   */
  const recaptcha = useRef<{ clear: () => void } | null>(null);
  const confirmation = useRef<{ confirm: (code: string) => Promise<unknown> } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      recaptcha.current?.clear();
      recaptcha.current = null;
    },
    [],
  );

  /** A form's own hidden input, so the wizard can require verification. */
  const hidden = (
    <input type="hidden" name="phoneVerified" value={stage === 'verified' ? 'true' : ''} />
  );

  if (stage === 'verified') {
    return (
      /*
       * `id="phone"`, matching the unverified branch — and **not**
       * `phoneVerified`, which is the name of the hidden flag below.
       * `form.elements.namedItem()` matches on `id` *and* `name`, so an
       * element carrying one as its id and another carrying it as its name
       * makes the lookup return a `RadioNodeList` instead of the input. The
       * wizard's step-1 gate reads that flag through exactly that call, and the
       * symptom was a verified dealer who could not press Continue.
       */
      <Field id="phone" label="Mobile" error={state.fieldError ?? error}>
        <div className="flex flex-wrap items-center gap-[10px]">
          {/*
            A real `<input>`, disabled and without a `name`, rather than a
            `<span>`. A span cannot be labelled — `<label for>` needs a
            labelable element — so the field would announce as nothing to a
            screen reader, and this is the row that says whose number a buyer
            will ring. It is the `LockedField` shape from the profile screen,
            for the same reason and with the same two properties: disabled
            controls are not submitted, and one with no name has nothing to be
            submitted under.
          */}
          <input
            id="phone"
            className="input tnum w-auto"
            value={display || initialPhoneDisplay}
            disabled
            readOnly
          />
          <StatusTag tone="ok">Verified</StatusTag>
          {/*
            The way back is a button rather than an editable box. Changing the
            number is not an edit — it is a new claim about a different handset,
            and it has to go through an OTP like the first one did.
          */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStage('number');
              setState({});
              setCode('');
            }}
          >
            Change
          </Button>
        </div>
        {hidden}
      </Field>
    );
  }

  async function sendCode(): Promise<void> {
    setState({});
    const started = await startPhoneVerificationAction(typed);
    if (!started.phone) {
      setState(started);
      return;
    }

    // Without Firebase there is nothing to send. The panel below says so; this
    // is the guard that stops the SDK being imported into a page that cannot
    // use it.
    if (!firebase) {
      setState({
        error: 'Phone verification is not configured for this environment.',
        phone: started.phone,
      });
      return;
    }

    try {
      const [{ initializeApp, getApps }, { getAuth, RecaptchaVerifier, signInWithPhoneNumber }] =
        await Promise.all([import('firebase/app'), import('firebase/auth')]);

      // `getApps()` first: React strict mode mounts twice in development, and
      // `initializeApp` throws on the second call with the same name.
      const app = getApps()[0] ?? initializeApp(firebase);
      const auth = getAuth(app);
      /*
       * The device's own language, so the SMS arrives in it. Firebase falls
       * back to English when it has no template for the locale, which is the
       * right failure — an untranslated code is still a code.
       */
      auth.useDeviceLanguage();

      recaptcha.current ??= new RecaptchaVerifier(auth, containerRef.current ?? 'recaptcha-slot', {
        size: 'invisible',
      });

      confirmation.current = await signInWithPhoneNumber(
        auth,
        started.phone,
        recaptcha.current as never,
      );

      setE164(started.phone);
      setDisplay(started.phoneDisplay ?? started.phone);
      setStage('code');
    } catch (error) {
      /*
       * Firebase's own codes, translated once, here. `auth/too-many-requests`
       * is the one a dealer actually meets — the per-number and per-project
       * quotas are real and are hit by testing — and "try again later" without
       * saying *why* is the message that generates a support ticket.
       */
      recaptcha.current?.clear();
      recaptcha.current = null;
      setState({ error: messageFor(error), phone: started.phone });
    }
  }

  async function confirmCode(): Promise<void> {
    if (!confirmation.current) {
      setState({ error: 'Send a code first.' });
      return;
    }

    setState({});
    try {
      const credential = (await confirmation.current.confirm(code)) as {
        user: { getIdToken: () => Promise<string> };
      };
      const idToken = await credential.user.getIdToken();

      /*
       * The Firebase sign-in is a means, not an end. Ours is the session that
       * matters, so the browser's Firebase session is discarded the moment the
       * token has been handed over — leaving it signed in would be a second
       * identity in the tab for no reason.
       */
      const result = await verifyPhoneAction(idToken);
      void (await import('firebase/auth'))
        .getAuth()
        .signOut()
        .catch(() => undefined);

      if (!result.verified) {
        setState(result);
        return;
      }

      setDisplay(result.phoneDisplay ?? display);
      setState({});
      setStage('verified');
    } catch (error) {
      setState({ error: messageFor(error) });
    }
  }

  return (
    <Field
      id="phone"
      label="Mobile"
      hint={stage === 'code' ? `code sent to ${display}` : '+91'}
      error={state.fieldError ?? error}
    >
      {stage === 'number' ? (
        <div className="flex items-start gap-[8px]">
          <Input
            id="phone"
            className="tnum"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98400 12345"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
            }}
            required
            aria-required="true"
            aria-invalid={(state.fieldError ?? error) ? true : undefined}
          />
          <Button
            variant="secondary"
            className="h-[38px] flex-none"
            loading={pending}
            disabled={typed.trim().length === 0}
            onClick={() => {
              startTransition(async () => {
                await sendCode();
              });
            }}
          >
            Send code
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-[8px]">
          <div className="flex items-start gap-[8px]">
            <Input
              id="phone"
              className="tnum"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              maxLength={6}
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, ''));
              }}
            />
            <Button
              variant="primary"
              className="h-[38px] flex-none"
              loading={pending}
              disabled={code.length < 6}
              onClick={() => {
                startTransition(async () => {
                  await confirmCode();
                });
              }}
            >
              Verify
            </Button>
          </div>
          <div className="flex gap-[12px] text-[11px]">
            <button
              type="button"
              className="ink-secondary underline"
              onClick={() => {
                setStage('number');
                setState({});
                setCode('');
              }}
            >
              Change number
            </button>
            <button
              type="button"
              className="ink-secondary underline"
              onClick={() => {
                startTransition(async () => {
                  await sendCode();
                });
              }}
            >
              Send it again
            </button>
          </div>
        </div>
      )}

      {state.error ? (
        <p role="alert" className="mt-[6px] text-[11px] text-(--color-err)">
          {state.error}
        </p>
      ) : null}

      {firebase ? null : (
        <p className="mt-[6px] text-[11px] ink-subtle">
          This environment has no Firebase project configured, so no code can be sent. Set
          <code> PHONE_VERIFICATION_DRIVER=firebase</code> and the three <code>FIREBASE_*</code>{' '}
          variables on the API.
        </p>
      )}

      {/*
        reCAPTCHA renders into this node. Invisible, but it must exist and stay
        in the document for the lifetime of the verifier — Firebase holds the
        element, and a node React has unmounted underneath it is the usual cause
        of `auth/internal-error` on a second attempt.
      */}
      <div id="recaptcha-slot" ref={containerRef} />

      <input type="hidden" name="phone" value={e164} />
      {hidden}
    </Field>
  );
}

/**
 * What a dealer is told when the deployment, rather than the dealer, is wrong.
 *
 * None of these is anything they can act on — a Firebase project without
 * billing is not a mistyped number — so the message says so plainly instead of
 * inviting them to try again into the same wall. The *actionable* half goes to
 * the console, in `SETUP_HINTS`.
 */
const MISCONFIGURED =
  'Phone verification is unavailable right now. This is on us — please contact support.';

/**
 * What the person reading the console should do about it.
 *
 * Every one of these produced the same dead-end "that did not work" before, and
 * every one is a console setting rather than a code change. The hint is the
 * whole point: an error that names the fix turns a support ticket into a
 * two-minute job.
 */
const SETUP_HINTS: Record<string, string> = {
  'auth/billing-not-enabled':
    'Firebase Phone Authentication requires the Blaze (pay-as-you-go) plan. Firebase console → ⚙ → Usage and billing → Details & settings → Modify plan → Blaze. Set a budget alert at the same time.',
  'auth/operation-not-allowed':
    'Phone sign-in is not enabled on this Firebase project. Console → Authentication → Sign-in method → Phone → Enable.',
  'auth/unauthorized-domain':
    'This host is not in the project’s authorised domains. Console → Authentication → Settings → Authorised domains. `localhost` is there by default; a deployed host is not.',
  'auth/invalid-app-credential':
    'The reCAPTCHA token was rejected. Usually the authorised-domain list, or an App Check enforcement with no provider registered for this host.',
  'auth/api-key-not-valid':
    'FIREBASE_WEB_API_KEY does not match this project. Console → Project settings → General → Your apps → Web app.',
  'auth/invalid-api-key':
    'FIREBASE_WEB_API_KEY does not match this project. Console → Project settings → General → Your apps → Web app.',
  'auth/internal-error':
    'Often FIREBASE_AUTH_DOMAIN: it must be the full `<project>.firebaseapp.com`, and its /__/auth/iframe must load.',
};

/**
 * Firebase's error codes, said once in the product's own voice — **and logged,
 * always**.
 *
 * The logging is the part that was missing, and its absence is what made this
 * function actively harmful. An unrecognised code fell through to "contact
 * support if it keeps happening", which told the dealer nothing and told
 * support less: the provider's own explanation was caught, mapped to a sentence
 * that disclaimed knowledge of the cause, and dropped. The first real
 * misconfiguration this met — `auth/billing-not-enabled`, which is not in the
 * SDK's own error map either and so arrives as a kebab-cased server string —
 * was undiagnosable from the screen.
 *
 * A dealer never opens a console. The person they contact always does.
 */
function messageFor(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? '';
  const detail = error instanceof Error ? error.message : String(error);
  const hint = SETUP_HINTS[code];

  /*
   * `warn`, not `error`, and the reason is specific rather than stylistic.
   *
   * Next's dev overlay patches `console.error` only
   * (`next-devtools/…/intercept-console-error.js`) and, when the first argument
   * is not an `Error`, takes **`args[1]`** as one — which is exactly the raw
   * error this line wants to attach. The result was a full-screen overlay on a
   * *handled* failure: a dealer mistyping an OTP in development interrupted the
   * very flow being tested, for something the screen already reports properly.
   * An overlay is for faults that break the page, and none of these does.
   *
   * It is also the right level on its own terms, and the one the API already
   * uses for this same class of event — `logger.warn(…, 'phone verification
   * token rejected')`. A provider refusing a request we then explain to the
   * dealer is a warning, not an unhandled error.
   *
   * The detail goes in the *printed line*, not only in the structured argument:
   * an object is expandable in a browser console and collapses to
   * `[object Object]` everywhere else, and the provider's own sentence is the
   * one thing this line exists to carry.
   */
  console.warn(
    [
      '[phone-verification] Firebase rejected the request',
      `  code:   ${code || '(none)'}`,
      `  detail: ${detail}`,
      ...(hint ? [`  fix:    ${hint}`] : []),
    ].join('\n'),
    // The error itself too, so the stack is one click away.
    error,
  );

  switch (code) {
    case 'auth/invalid-verification-code':
      return 'That code is not right. Check it and try again.';
    case 'auth/code-expired':
    case 'auth/session-expired':
      return 'That code has expired. Send a new one.';
    case 'auth/invalid-phone-number':
      return 'That does not look like a mobile number.';
    case 'auth/too-many-requests':
      return 'Too many attempts from this device. Wait a few minutes and try again.';
    case 'auth/quota-exceeded':
      return 'We cannot send a code right now. Try again shortly, or contact support.';
    case 'auth/captcha-check-failed':
      return 'The security check did not pass. Reload the page and try again.';
    case 'auth/network-request-failed':
      return 'The network dropped. Check your connection and try again.';

    /*
     * Deployment faults, not dealer faults. Grouped because the dealer-facing
     * answer is identical for all of them — there is nothing they can do — and
     * because telling somebody to "try again" against a project with no billing
     * is an instruction to fail repeatedly.
     */
    case 'auth/billing-not-enabled':
    case 'auth/operation-not-allowed':
    case 'auth/unauthorized-domain':
    case 'auth/invalid-app-credential':
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':
    case 'auth/internal-error':
      return MISCONFIGURED;

    default:
      return 'That did not work. Try again, or contact support if it keeps happening.';
  }
}
